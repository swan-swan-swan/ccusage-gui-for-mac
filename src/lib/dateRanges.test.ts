import { describe, expect, it } from "vitest";
import { getSinceDate, timeRangeOptions } from "./dateRanges";

describe("date range presets", () => {
  const today = new Date("2026-06-29T10:30:00+08:00");

  it("formats today as YYYYMMDD", () => {
    expect(getSinceDate("today", today)).toBe("20260629");
  });

  it("uses inclusive lookback dates for rolling ranges", () => {
    expect(getSinceDate("1d", today)).toBe("20260628");
    expect(getSinceDate("3d", today)).toBe("20260626");
    expect(getSinceDate("7d", today)).toBe("20260622");
    expect(getSinceDate("15d", today)).toBe("20260614");
    expect(getSinceDate("30d", today)).toBe("20260530");
  });

  it("exposes the exact supported preset menu", () => {
    expect(timeRangeOptions.map((option) => option.id)).toEqual([
      "today",
      "1d",
      "3d",
      "7d",
      "15d",
      "30d",
    ]);
  });
});
