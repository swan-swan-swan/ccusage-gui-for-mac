import type { AppSettings, Language, ThemeMode, TimeRangeId } from "./types";

const defaultTimeRangeId: TimeRangeId = "7d";

export const defaultSettings: AppSettings = {
  activeToolIds: ["codex"],
  lastSelectedToolId: "codex",
  lastTimeRangeId: defaultTimeRangeId,
  themeMode: "system",
  language: "zh-CN",
};

export function normalizeSettings(
  value: Partial<AppSettings> | null | undefined,
  availableToolIds: string[],
): AppSettings {
  const available = new Set(availableToolIds);
  const savedActiveTools = Array.isArray(value?.activeToolIds) ? value.activeToolIds : defaultSettings.activeToolIds;
  let activeToolIds = savedActiveTools.filter((toolId) => available.has(toolId));

  if (activeToolIds.length === 0) {
    activeToolIds = availableToolIds.length > 0 ? [availableToolIds[0]] : defaultSettings.activeToolIds;
  }

  const selectedToolId =
    value?.lastSelectedToolId && activeToolIds.includes(value.lastSelectedToolId)
      ? value.lastSelectedToolId
      : activeToolIds[0] ?? null;

  return {
    activeToolIds,
    lastSelectedToolId: selectedToolId,
    lastTimeRangeId: isTimeRangeId(value?.lastTimeRangeId) ? value.lastTimeRangeId : defaultTimeRangeId,
    themeMode: isThemeMode(value?.themeMode) ? value.themeMode : defaultSettings.themeMode,
    language: isLanguage(value?.language) ? value.language : defaultSettings.language,
  };
}

function isTimeRangeId(value: unknown): value is TimeRangeId {
  return value === "today" || value === "1d" || value === "3d" || value === "7d" || value === "15d" || value === "30d";
}

function isLanguage(value: unknown): value is Language {
  return value === "zh-CN" || value === "en-US";
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}
