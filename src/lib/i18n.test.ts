import { describe, expect, it } from "vitest";
import { getLanguageLabel, getTimeRangeLabel, t } from "./i18n";

describe("i18n", () => {
  it("returns Chinese labels by default language", () => {
    expect(t("zh-CN", "tokenUsage")).toBe("Token 用量");
    expect(t("zh-CN", "settings")).toBe("设置");
    expect(getTimeRangeLabel("zh-CN", "7d")).toBe("最近 7 天");
  });

  it("returns English labels when language is English", () => {
    expect(t("en-US", "tokenUsage")).toBe("Token Usage");
    expect(t("en-US", "settings")).toBe("Settings");
    expect(getTimeRangeLabel("en-US", "7d")).toBe("Last 7 days");
  });

  it("exposes language selector labels", () => {
    expect(getLanguageLabel("zh-CN")).toBe("简体中文");
    expect(getLanguageLabel("en-US")).toBe("English");
  });
});
