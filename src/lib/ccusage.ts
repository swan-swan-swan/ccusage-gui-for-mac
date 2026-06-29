import type { AiTool } from "./types";

const aggregateCommands = new Set([
  "daily",
  "monthly",
  "weekly",
  "session",
  "blocks",
  "statusline",
]);

const toolLabels: Record<string, string> = {
  amp: "Amp",
  claude: "Claude Code",
  codebuff: "Codebuff",
  codex: "Codex",
  copilot: "GitHub Copilot",
  droid: "Droid",
  gemini: "Gemini",
  goose: "Goose",
  hermes: "Hermes",
  kilo: "Kilo",
  kimi: "Kimi",
  openclaw: "OpenClaw",
  opencode: "OpenCode",
  pi: "pi-agent",
  qwen: "Qwen",
};

export function parseSupportedTools(helpText: string): AiTool[] {
  return helpText
    .split("\n")
    .map((line) => line.match(/^\s{2,}([a-z][a-z0-9-]*)\s{2,}/)?.[1])
    .filter((id): id is string => {
      return typeof id === "string" && !aggregateCommands.has(id);
    })
    .map((id) => ({ id, label: toolLabels[id] ?? titleCase(id) }));
}

function titleCase(value: string): string {
  return value
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
