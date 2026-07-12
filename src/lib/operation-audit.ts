import type { ResultSetHeader } from "mysql2";
import type { AuthUser } from "@/lib/auth";
import { getPool } from "@/lib/db";

function mysqlDate(value: Date) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

export async function beginOperationAudit(input: {
  user: AuthUser;
  requestId: string;
  action: string;
  targetType: string;
  target: string;
  ip: string | null;
  metadata?: Record<string, unknown>;
}) {
  const [result] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO operation_audit_logs
      (request_id, user_id, user_name, user_role, action_name, target_type, target_name, status,
       request_ip, metadata_json, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?)`,
    [
      input.requestId,
      input.user.id,
      input.user.name,
      input.user.role,
      input.action,
      input.targetType,
      input.target,
      input.ip,
      JSON.stringify(input.metadata ?? {}),
      mysqlDate(new Date()),
    ],
  );
  return result.insertId;
}

export async function finishOperationAudit(
  id: number,
  status: "scheduled" | "success" | "failed",
  message: string,
) {
  await getPool().execute(
    `UPDATE operation_audit_logs
     SET status = ?, message = ?, finished_at = ?
     WHERE id = ?`,
    [status, message.slice(0, 500), mysqlDate(new Date()), id],
  );
}
