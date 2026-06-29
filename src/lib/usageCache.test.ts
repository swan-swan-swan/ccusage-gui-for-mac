import { describe, expect, it } from "vitest";
import { createUsageCache } from "./usageCache";
import type { RawUsageReport } from "./types";

describe("usage cache", () => {
  it("deduplicates identical tool and since requests", async () => {
    const report: RawUsageReport = { totals: { totalTokens: 1 }, sessions: [] };
    const calls: string[] = [];
    const cache = createUsageCache(async (toolId, since) => {
      calls.push(`${toolId}:${since}`);
      return report;
    });

    await cache.load("codex", "20260622");
    await cache.load("codex", "20260622");

    expect(calls).toEqual(["codex:20260622"]);
  });

  it("refresh bypasses the cached value", async () => {
    const cache = createUsageCache(async () => ({
      totals: { totalTokens: Math.random() },
      sessions: [],
    }));

    const first = await cache.load("codex", "20260622");
    const second = await cache.load("codex", "20260622", { refresh: true });

    expect(second).not.toBe(first);
  });

  it("does not retain rejected requests", async () => {
    let calls = 0;
    const cache = createUsageCache(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("temporary failure");
      }
      return { totals: { totalTokens: 2 }, sessions: [] };
    });

    await expect(cache.load("codex", "20260622")).rejects.toThrow("temporary failure");
    await expect(cache.load("codex", "20260622")).resolves.toEqual({
      totals: { totalTokens: 2 },
      sessions: [],
    });
  });
});
