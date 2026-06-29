import { describe, expect, it } from "vitest";
import { defaultSettings, normalizeSettings } from "./settings";

describe("settings normalization", () => {
  it("uses codex as the default active tool", () => {
    expect(defaultSettings).toEqual({
      activeToolIds: ["codex"],
      lastSelectedToolId: "codex",
      lastTimeRangeId: "7d",
      themeMode: "system",
      language: "zh-CN",
    });
  });

  it("removes unknown active tools and keeps a valid selected tool", () => {
    expect(
      normalizeSettings(
        {
          activeToolIds: ["codex", "ghost"],
          lastSelectedToolId: "ghost",
          lastTimeRangeId: "30d",
          themeMode: "system",
          language: "en-US",
        },
        ["codex", "goose"],
      ),
    ).toEqual({
      activeToolIds: ["codex"],
      lastSelectedToolId: "codex",
      lastTimeRangeId: "30d",
      themeMode: "system",
      language: "en-US",
    });
  });

  it("falls back to the first available tool when all saved tools are unavailable", () => {
    expect(normalizeSettings({ activeToolIds: ["ghost"] }, ["goose", "qwen"])).toEqual({
      activeToolIds: ["goose"],
      lastSelectedToolId: "goose",
      lastTimeRangeId: "7d",
      themeMode: "system",
      language: "zh-CN",
    });
  });

  it("falls back to Chinese when saved language is unsupported", () => {
    expect(normalizeSettings({ language: "fr-FR" } as unknown as Parameters<typeof normalizeSettings>[0], ["codex"]).language).toBe("zh-CN");
  });
});
