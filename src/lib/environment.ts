import type { EnvironmentStatus } from "./types";

export type EnvironmentAction = "ready" | "install-ccusage" | "node-required";

export function parseNodeMajorVersion(version: string | null): number | null {
  if (!version) {
    return null;
  }

  const match = version.match(/v?(\d+)\./);
  return match ? Number(match[1]) : null;
}

export function getEnvironmentAction(status: EnvironmentStatus): EnvironmentAction {
  if (!status.nodeInstalled || !status.nodeMeetsRequirement) {
    return "node-required";
  }

  if (!status.ccusageInstalled) {
    return "install-ccusage";
  }

  return "ready";
}
