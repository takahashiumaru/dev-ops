import { runRemote } from "@/lib/server-live";

export type OperationAction = "start" | "stop" | "restart";

type ServicePolicy = {
  label: string;
  scope: "system" | "user";
  actions: readonly OperationAction[];
};

export const servicePolicies: Record<string, ServicePolicy> = {
  nginx: { label: "Nginx", scope: "system", actions: ["start", "restart"] },
  "php8.3-fpm": {
    label: "PHP 8.3 FPM",
    scope: "system",
    actions: ["start", "restart"],
  },
  mysql: { label: "MySQL", scope: "system", actions: ["start", "restart"] },
  docker: {
    label: "Docker engine",
    scope: "system",
    actions: ["start", "restart"],
  },
  supervisor: {
    label: "Supervisor",
    scope: "system",
    actions: ["start", "stop", "restart"],
  },
  cron: {
    label: "Cron",
    scope: "system",
    actions: ["start", "stop", "restart"],
  },
  "hermes-dashboard.service": {
    label: "Hermes Dashboard",
    scope: "system",
    actions: ["start", "stop", "restart"],
  },
  "mnemosyne-dashboard.service": {
    label: "Mnemosyne Dashboard",
    scope: "system",
    actions: ["start", "stop", "restart"],
  },
  "taka-fintrack.service": {
    label: "Taka FinTrack",
    scope: "user",
    actions: ["start", "stop", "restart"],
  },
  "9router.service": {
    label: "9Router",
    scope: "user",
    actions: ["start", "stop", "restart"],
  },
  "hermes-gateway.service": {
    label: "Hermes Gateway",
    scope: "user",
    actions: ["start", "stop", "restart"],
  },
  "server-monitoring.service": {
    label: "Server Monitoring",
    scope: "user",
    actions: ["start", "stop", "restart"],
  },
  "taka-school.service": {
    label: "Taka School",
    scope: "user",
    actions: ["start", "stop", "restart"],
  },
};

function scheduledUnit(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

export function validateServiceAction(target: string, action: string) {
  const policy = servicePolicies[target];
  if (!policy || !policy.actions.includes(action as OperationAction)) return null;
  return { ...policy, action: action as OperationAction };
}

export function serviceActionRoles(target: string) {
  if (["mysql", "docker"].includes(target)) return ["owner"] as const;
  if (
    [
      "nginx",
      "php8.3-fpm",
      "supervisor",
      "cron",
      "hermes-dashboard.service",
      "mnemosyne-dashboard.service",
    ].includes(target)
  ) {
    return ["owner", "admin"] as const;
  }
  return ["owner", "admin", "operator"] as const;
}

export async function runServiceAction(target: string, action: OperationAction) {
  const policy = validateServiceAction(target, action);
  if (!policy) throw new Error("Service action is not allowed");

  if (target === "docker" && action === "restart") {
    const unit = scheduledUnit("opsdeck-docker-restart");
    await runRemote(
      `sudo -n systemd-run --unit=${unit} --on-active=3s /usr/bin/systemctl restart docker`,
    );
    return {
      scheduled: true,
      message: "Docker engine restart scheduled. The dashboard may reconnect briefly.",
    };
  }

  const systemctl =
    policy.scope === "user" ? "systemctl --user" : "sudo -n systemctl";
  await runRemote(`${systemctl} ${action} ${target}`);
  const output = await runRemote(
    `${systemctl} is-active ${target} 2>/dev/null || true`,
  );
  const expectedState = action === "stop" ? "inactive" : "active";
  if (output !== expectedState) {
    throw new Error(
      `${policy.label} ${action} did not reach ${expectedState}. Current state: ${output || "unknown"}.`,
    );
  }
  return {
    scheduled: false,
    message: `${policy.label} ${action} completed. Current state: ${output || "unknown"}.`,
  };
}

export function validateContainerTarget(target: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(target)) return false;
  const configured = (process.env.DOCKER_ACTION_ALLOWLIST || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(["dev-ops-dashboard", ...configured]).has(target);
}

export async function runContainerAction(
  target: string,
  action: OperationAction,
) {
  if (!(["start", "stop", "restart"] as const).includes(action)) {
    throw new Error("Container action is not allowed");
  }
  if (!validateContainerTarget(target)) {
    throw new Error("Container target is not valid");
  }

  if (target === "dev-ops-dashboard") {
    if (action !== "restart") {
      throw new Error("The Opsdeck container can only be restarted here");
    }
    const unit = scheduledUnit("opsdeck-self-restart");
    await runRemote(
      `sudo -n systemd-run --unit=${unit} --on-active=3s /usr/bin/systemctl restart dev-ops-dashboard.service`,
    );
    return {
      scheduled: true,
      message: "Opsdeck restart scheduled. This page will reconnect shortly.",
    };
  }

  const output = await runRemote(
    `docker inspect ${target} >/dev/null 2>&1 && docker ${action} ${target} >/dev/null && docker inspect --format '{{.State.Status}}' ${target}`,
  );
  return {
    scheduled: false,
    message: `Container ${target} ${action} completed. Current state: ${output || "unknown"}.`,
  };
}

export async function scheduleServerReboot() {
  const unit = scheduledUnit("opsdeck-server-reboot");
  await runRemote(
    `sudo -n systemd-run --unit=${unit} --on-active=5s /usr/sbin/reboot`,
  );
  return {
    scheduled: true,
    message: "Server reboot scheduled. Services will be unavailable while the VPS starts.",
  };
}
