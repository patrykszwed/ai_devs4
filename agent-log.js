import { appendFileSync } from "node:fs";

export function logAgentEvent(event) {
  const path = process.env.DASHBOARD_AGENT_LOG;
  if (!path || typeof event !== "object") return;
  try {
    appendFileSync(path, JSON.stringify(event) + "\n", "utf-8");
  } catch (_) {}
}
