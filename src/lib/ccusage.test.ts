import { describe, expect, it } from "vitest";
import { parseSupportedTools } from "./ccusage";

const helpText = `
USAGE:
  ccusage [daily] <OPTIONS>
  ccusage <COMMANDS>

COMMANDS:
  daily                      Show all detected coding (agent) CLI usage grouped by date
  monthly                    Show all detected coding (agent) CLI usage grouped by month
  weekly                     Show all detected coding (agent) CLI usage grouped by week
  session                    Show all detected coding (agent) CLI usage grouped by session
  blocks                     Show usage report grouped by session billing blocks
  statusline                 Display compact status line
  claude                     Show Claude Code usage commands
  codex                      Show Codex token usage commands
  opencode                   Show OpenCode token usage commands
  amp                        Show Amp token usage commands
  goose                      Show Goose usage commands
  qwen                       Show Qwen usage commands

OPTIONS:
  -j, --json                 Output in JSON format
`;

describe("ccusage help parsing", () => {
  it("returns AI tools and excludes aggregate report commands", () => {
    expect(parseSupportedTools(helpText)).toEqual([
      { id: "claude", label: "Claude Code" },
      { id: "codex", label: "Codex" },
      { id: "opencode", label: "OpenCode" },
      { id: "amp", label: "Amp" },
      { id: "goose", label: "Goose" },
      { id: "qwen", label: "Qwen" },
    ]);
  });

  it("keeps unknown future tools with title-cased labels", () => {
    expect(parseSupportedTools("COMMANDS:\n  newagent   Show NewAgent usage commands\n")).toEqual([
      { id: "newagent", label: "Newagent" },
    ]);
  });
});
