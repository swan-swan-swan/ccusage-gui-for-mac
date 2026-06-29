import { invoke } from "@tauri-apps/api/core";
import type { AiTool, AppSettings, EnvironmentStatus, InstallResult, RawUsageReport } from "./types";
import { defaultSettings } from "./settings";

const mockTools: AiTool[] = [
  { id: "codex", label: "Codex" },
  { id: "claude", label: "Claude Code" },
  { id: "goose", label: "Goose" },
  { id: "qwen", label: "Qwen" },
];

const mockReport: RawUsageReport = {
  totals: {
    inputTokens: 124_800,
    outputTokens: 48_320,
    cacheCreationTokens: 31_450,
    cacheReadTokens: 92_900,
    reasoningOutputTokens: 8_120,
    totalTokens: 305_590,
    costUSD: 7.84,
  },
  sessions: [
    {
      sessionId: "codex-6f78aa",
      inputTokens: 50_100,
      outputTokens: 18_500,
      cacheCreationTokens: 10_200,
      cacheReadTokens: 28_700,
      totalTokens: 107_500,
      costUSD: 2.94,
      createdAt: "2026-06-27T19:20:00Z",
      lastActivity: "2026-06-29T01:15:00Z",
      directory: "~/Documents/Go项目/ccusage-gui-for-mac",
      models: {},
    },
    {
      sessionId: "codex-a91d40",
      inputTokens: 42_800,
      outputTokens: 21_600,
      cacheCreationTokens: 8_600,
      cacheReadTokens: 40_100,
      totalTokens: 113_100,
      costUSD: 3.12,
      createdAt: "2026-06-28T08:05:00Z",
      lastActivity: "2026-06-28T16:42:00Z",
      directory: "~/Desktop/research",
      models: {},
    },
    {
      sessionId: "codex-2bc310",
      inputTokens: 31_900,
      outputTokens: 8_220,
      cacheCreationTokens: 12_650,
      cacheReadTokens: 24_100,
      totalTokens: 84_990,
      costUSD: 1.78,
      createdAt: null,
      lastActivity: "2026-06-26T12:00:00Z",
      directory: "~/Projects/agent-tools",
      models: {},
    },
  ],
};

export async function checkEnvironment(): Promise<EnvironmentStatus> {
  if (!isTauriRuntime()) {
    return {
      nodeInstalled: true,
      nodeVersion: "v22.22.0",
      nodeMajor: 22,
      nodeMeetsRequirement: true,
      ccusageInstalled: true,
      ccusageVersion: "20.0.14",
    };
  }

  return invoke("check_environment");
}

export async function installCcusage(): Promise<InstallResult> {
  if (!isTauriRuntime()) {
    return { success: true, stdout: "Mock install complete", stderr: "" };
  }

  return invoke("install_ccusage");
}

export async function listSupportedTools(): Promise<AiTool[]> {
  if (!isTauriRuntime()) {
    return mockTools;
  }

  return invoke("list_supported_tools");
}

export async function loadUsage(toolId: string, since: string): Promise<RawUsageReport> {
  if (!isTauriRuntime()) {
    return {
      ...mockReport,
      sessions: mockReport.sessions?.map((session) => ({
        ...session,
        sessionId: session.sessionId?.replace("codex", toolId) ?? session.sessionId,
      })),
    };
  }

  return invoke("load_usage", { tool: toolId, since });
}

export async function getSettings(): Promise<AppSettings> {
  if (!isTauriRuntime()) {
    return defaultSettings;
  }

  return invoke("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  return invoke("save_settings", { settings });
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}
