import crypto from "node:crypto";
import type { Client, ClientChannel } from "ssh2";
import { openRemoteShell } from "@/lib/server-live";

type Subscriber = (event: { type: "data" | "exit"; data: string }) => void;
type TerminalSession = {
  id: string;
  userId: number;
  client: Client;
  stream: ClientChannel;
  subscribers: Set<Subscriber>;
  backlog: Array<{ type: "data" | "exit"; data: string }>;
  createdAt: number;
  touchedAt: number;
  closed: boolean;
};
type TerminalState = { sessions: Map<string, TerminalSession> };
const globalTerminal = globalThis as typeof globalThis & { __opsdeckTerminal?: TerminalState };

function state() {
  globalTerminal.__opsdeckTerminal ??= { sessions: new Map() };
  return globalTerminal.__opsdeckTerminal;
}

function emit(session: TerminalSession, event: Parameters<Subscriber>[0]) {
  if (session.subscribers.size === 0) session.backlog.push(event);
  if (session.backlog.length > 128) session.backlog.shift();
  for (const subscriber of session.subscribers) subscriber(event);
}

export async function createTerminalSession(userId: number, cols: number, rows: number) {
  for (const session of state().sessions.values()) {
    if (session.userId === userId) closeTerminalSession(session.id, userId);
  }
  const { client, stream } = await openRemoteShell(cols, rows);
  const session: TerminalSession = {
    id: crypto.randomUUID(), userId, client, stream, subscribers: new Set(), backlog: [],
    createdAt: Date.now(), touchedAt: Date.now(), closed: false,
  };
  state().sessions.set(session.id, session);
  stream.on("data", (chunk: Buffer) => emit(session, { type: "data", data: chunk.toString("base64") }));
  stream.stderr.on("data", (chunk: Buffer) => emit(session, { type: "data", data: chunk.toString("base64") }));
  stream.on("close", () => {
    session.closed = true;
    emit(session, { type: "exit", data: "SSH session closed" });
    session.subscribers.clear();
    client.end();
    setTimeout(() => state().sessions.delete(session.id), 10_000);
  });
  return session.id;
}

export function getTerminalSession(id: string, userId: number) {
  const session = state().sessions.get(id);
  if (!session || session.userId !== userId || session.closed) return null;
  if (Date.now() - session.touchedAt > 30 * 60_000) {
    closeTerminalSession(id, userId);
    return null;
  }
  session.touchedAt = Date.now();
  return session;
}

export function writeTerminalSession(id: string, userId: number, data: string) {
  const session = getTerminalSession(id, userId);
  if (!session) return false;
  session.stream.write(data);
  return true;
}

export function resizeTerminalSession(id: string, userId: number, cols: number, rows: number) {
  const session = getTerminalSession(id, userId);
  if (!session) return false;
  session.stream.setWindow(rows, cols, 0, 0);
  return true;
}

export function subscribeTerminalSession(id: string, userId: number, subscriber: Subscriber) {
  const session = getTerminalSession(id, userId);
  if (!session) return null;
  session.subscribers.add(subscriber);
  for (const event of session.backlog) subscriber(event);
  session.backlog = [];
  return () => session.subscribers.delete(subscriber);
}

export function closeTerminalSession(id: string, userId: number) {
  const session = state().sessions.get(id);
  if (!session || session.userId !== userId) return false;
  session.closed = true;
  session.stream.end("exit\n");
  session.client.end();
  state().sessions.delete(id);
  return true;
}
