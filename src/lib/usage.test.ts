import { describe, expect, it } from "vitest";
import {
  buildCompositionData,
  buildModelTokenData,
  buildSessionRows,
  buildSummaryCards,
  buildTrendData,
  filterAndSortSessions,
  normalizeUsageReport,
} from "./usage";
import type { RawUsageReport, SessionUsageRow } from "./types";

const rawReport: RawUsageReport = {
  totals: {
    inputTokens: 100,
    outputTokens: 40,
    cacheCreationTokens: 25,
    cacheReadTokens: 10,
    totalTokens: 175,
    costUSD: 1.2345,
  },
  sessions: [
    {
      sessionId: "alpha-session",
      inputTokens: 75,
      outputTokens: 30,
      cacheCreationTokens: 20,
      cacheReadTokens: 5,
      totalTokens: 130,
      costUSD: 1.1,
      lastActivity: "2026-06-29T08:10:00Z",
      createdAt: "2026-06-28T22:00:00Z",
      directory: "/tmp/a",
      models: {
        "gpt-5": {
          inputTokens: 75,
          outputTokens: 30,
          cacheCreationTokens: 20,
          cacheReadTokens: 5,
          totalTokens: 130,
        },
      },
    },
    {
      sessionId: "beta-session",
      inputTokens: 25,
      outputTokens: 10,
      cacheCreationTokens: 5,
      cacheReadTokens: 5,
      totalTokens: 45,
      costUSD: 0.1345,
      lastActivity: "2026-06-27T12:00:00Z",
      createdAt: null,
      directory: "/tmp/b",
      models: {},
    },
  ],
};

describe("usage normalization", () => {
  it("normalizes totals and sessions with defaults", () => {
    const report = normalizeUsageReport(rawReport);

    expect(report.summary.totalTokens).toBe(175);
    expect(report.summary.cacheTokens).toBe(35);
    expect(report.sessions[0]).toMatchObject({
      sessionId: "alpha-session",
      inputTokens: 75,
      outputTokens: 30,
      cacheTokens: 25,
      costUSD: 1.1,
      createdAt: "2026-06-28T22:00:00Z",
      lastActivity: "2026-06-29T08:10:00Z",
    });
  });

  it("builds summary card view models", () => {
    expect(buildSummaryCards(normalizeUsageReport(rawReport).summary)).toEqual([
      { id: "input", label: "Input Tokens", value: "100", millionValue: "0.00M", tone: "blue" },
      { id: "output", label: "Output Tokens", value: "40", millionValue: "0.00M", tone: "green" },
      { id: "cache", label: "Cache Tokens", value: "35", millionValue: "0.00M", tone: "amber" },
      { id: "cost", label: "Estimated Cost", value: "$1.23", tone: "violet" },
    ]);
  });

  it("builds million token labels for token summary cards", () => {
    const cards = buildSummaryCards({
      inputTokens: 1_133_273,
      outputTokens: 100_302,
      cacheCreationTokens: 0,
      cacheReadTokens: 25_614_976,
      cacheTokens: 25_614_976,
      reasoningOutputTokens: 0,
      totalTokens: 26_848_551,
      costUSD: 21.48,
    });

    expect(cards.find((card) => card.id === "input")).toMatchObject({ millionValue: "1.13M" });
    expect(cards.find((card) => card.id === "output")).toMatchObject({ millionValue: "0.10M" });
    expect(cards.find((card) => card.id === "cache")).toMatchObject({ millionValue: "25.61M" });
    expect(cards.find((card) => card.id === "cost")).not.toHaveProperty("millionValue");
  });

  it("builds localized summary card labels", () => {
    expect(
      buildSummaryCards(normalizeUsageReport(rawReport).summary, {
        input: "输入 Token",
        output: "输出 Token",
        cache: "缓存 Token",
        cost: "预估成本",
      }).map((card) => card.label),
    ).toEqual(["输入 Token", "输出 Token", "缓存 Token", "预估成本"]);
  });

  it("builds composition chart data from the summary", () => {
    expect(buildCompositionData(normalizeUsageReport(rawReport).summary)).toEqual([
      { name: "Input", value: 100 },
      { name: "Output", value: 40 },
      { name: "Cache", value: 35 },
    ]);
  });

  it("builds model token chart data for the selected metric", () => {
    const report = normalizeUsageReport({
      totals: rawReport.totals,
      sessions: [
        {
          sessionId: "alpha-session",
          inputTokens: 120,
          outputTokens: 45,
          cacheCreationTokens: 20,
          cacheReadTokens: 10,
          models: {
            "gpt-5": {
              inputTokens: 80,
              outputTokens: 25,
              cacheCreationTokens: 10,
              cacheReadTokens: 5,
            },
            "gpt-5-mini": {
              inputTokens: 40,
              outputTokens: 20,
              cacheCreationTokens: 10,
              cacheReadTokens: 5,
            },
          },
        },
        {
          sessionId: "beta-session",
          inputTokens: 30,
          outputTokens: 15,
          cacheCreationTokens: 5,
          cacheReadTokens: 5,
          models: {},
        },
      ],
    });

    expect(buildModelTokenData(report.sessions, "input", "Unknown Model")).toEqual([
      { name: "gpt-5", value: 80 },
      { name: "gpt-5-mini", value: 40 },
      { name: "Unknown Model", value: 30 },
    ]);
    expect(buildModelTokenData(report.sessions, "output", "Unknown Model")).toEqual([
      { name: "gpt-5", value: 25 },
      { name: "gpt-5-mini", value: 20 },
      { name: "Unknown Model", value: 15 },
    ]);
    expect(buildModelTokenData(report.sessions, "cache", "Unknown Model")).toEqual([
      { name: "gpt-5", value: 15 },
      { name: "gpt-5-mini", value: 15 },
      { name: "Unknown Model", value: 10 },
    ]);
  });

  it("groups trend data by last activity date", () => {
    expect(buildTrendData(normalizeUsageReport(rawReport).sessions)).toEqual([
      { date: "2026-06-27", tokens: 45, costUSD: 0.1345 },
      { date: "2026-06-29", tokens: 130, costUSD: 1.1 },
    ]);
  });
});

describe("session table operations", () => {
  const rows: SessionUsageRow[] = buildSessionRows(normalizeUsageReport(rawReport).sessions);

  it("filters sessions by id case-insensitively", () => {
    expect(
      filterAndSortSessions(rows, {
        query: "ALPHA",
        sortKey: "lastActivity",
        sortDirection: "desc",
      }).map((row) => row.sessionId),
    ).toEqual(["alpha-session"]);
  });

  it("sorts by last active date descending", () => {
    expect(
      filterAndSortSessions(rows, {
        query: "",
        sortKey: "lastActivity",
        sortDirection: "desc",
      }).map((row) => row.sessionId),
    ).toEqual(["alpha-session", "beta-session"]);
  });

  it("sorts by input tokens ascending", () => {
    expect(
      filterAndSortSessions(rows, {
        query: "",
        sortKey: "inputTokens",
        sortDirection: "asc",
      }).map((row) => row.sessionId),
    ).toEqual(["beta-session", "alpha-session"]);
  });
});
