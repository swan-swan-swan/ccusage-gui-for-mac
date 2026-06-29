// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "./lib/settings";
import type { EnvironmentStatus, RawUsageReport } from "./lib/types";

const apiMocks = vi.hoisted(() => ({
  checkEnvironment: vi.fn(),
  getSettings: vi.fn(),
  installCcusage: vi.fn(),
  listSupportedTools: vi.fn(),
  loadUsage: vi.fn(),
  saveSettings: vi.fn(),
}));

const rechartsMock = vi.hoisted(() => ({
  pies: [] as Array<Record<string, unknown>>,
  tooltips: [] as Array<Record<string, unknown>>,
}));

vi.mock("./lib/api", () => ({
  checkEnvironment: apiMocks.checkEnvironment,
  getSettings: apiMocks.getSettings,
  installCcusage: apiMocks.installCcusage,
  listSupportedTools: apiMocks.listSupportedTools,
  loadUsage: apiMocks.loadUsage,
  saveSettings: apiMocks.saveSettings,
}));

vi.mock("recharts", async () => {
  const React = await import("react");
  const passthrough =
    (name: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", { "data-recharts": name }, children);

  return {
    Bar: passthrough("Bar"),
    BarChart: passthrough("BarChart"),
    CartesianGrid: passthrough("CartesianGrid"),
    Cell: passthrough("Cell"),
    Pie: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
      rechartsMock.pies.push(props);
      return React.createElement("div", { "data-recharts": "Pie" }, props.children);
    },
    PieChart: passthrough("PieChart"),
    ResponsiveContainer: passthrough("ResponsiveContainer"),
    Tooltip: (props: Record<string, unknown>) => {
      rechartsMock.tooltips.push(props);
      return React.createElement("div", { "data-testid": "tooltip-config" });
    },
    XAxis: passthrough("XAxis"),
    YAxis: passthrough("YAxis"),
  };
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

const readyEnvironment: EnvironmentStatus = {
  nodeInstalled: true,
  nodeVersion: "v22.22.0",
  nodeMajor: 22,
  nodeMeetsRequirement: true,
  ccusageInstalled: true,
  ccusageVersion: "20.0.14",
};

const usageReport: RawUsageReport = {
  totals: {
    inputTokens: 1_133_273,
    outputTokens: 100_302,
    cacheCreationTokens: 0,
    cacheReadTokens: 25_614_976,
    totalTokens: 26_848_551,
    costUSD: 21.48,
  },
  sessions: [
    {
      sessionId: "rollout-chart-test",
      inputTokens: 1_103_825,
      outputTokens: 98_515,
      cacheCreationTokens: 0,
      cacheReadTokens: 25_519_232,
      totalTokens: 26_721_572,
      costUSD: 21.23,
      createdAt: "2026-06-29T01:39:00Z",
      lastActivity: "2026-06-29T05:51:00Z",
      directory: "2026/06/29",
      models: {},
    },
  ],
};

const modelUsageReport: RawUsageReport = {
  totals: {
    inputTokens: 4_000_000,
    outputTokens: 1_320_000,
    cacheCreationTokens: 870_000,
    cacheReadTokens: 530_000,
    totalTokens: 6_720_000,
    costUSD: 3.2,
  },
  sessions: [
    {
      sessionId: "model-chart-test",
      inputTokens: 3_450_000,
      outputTokens: 1_110_000,
      cacheCreationTokens: 750_000,
      cacheReadTokens: 450_000,
      totalTokens: 5_760_000,
      costUSD: 3.2,
      createdAt: "2026-06-29T01:39:00Z",
      lastActivity: "2026-06-29T05:51:00Z",
      directory: "2026/06/29",
      models: {
        "gpt-5": {
          inputTokens: 2_340_000,
          outputTokens: 780_000,
          cacheCreationTokens: 500_000,
          cacheReadTokens: 300_000,
        },
        "gpt-5-mini": {
          inputTokens: 1_110_000,
          outputTokens: 330_000,
          cacheCreationTokens: 250_000,
          cacheReadTokens: 150_000,
        },
      },
    },
    {
      sessionId: "unknown-model-chart-test",
      inputTokens: 550_000,
      outputTokens: 210_000,
      cacheCreationTokens: 120_000,
      cacheReadTokens: 80_000,
      totalTokens: 960_000,
      costUSD: 0.8,
      createdAt: "2026-06-29T02:39:00Z",
      lastActivity: "2026-06-29T06:51:00Z",
      directory: "2026/06/29",
      models: {},
    },
  ],
};

beforeEach(() => {
  vi.resetModules();
  rechartsMock.pies.length = 0;
  rechartsMock.tooltips.length = 0;
  apiMocks.checkEnvironment.mockResolvedValue(readyEnvironment);
  apiMocks.getSettings.mockResolvedValue(defaultSettings);
  apiMocks.installCcusage.mockResolvedValue({ success: true, stdout: "", stderr: "" });
  apiMocks.listSupportedTools.mockResolvedValue([{ id: "codex", label: "Codex" }]);
  apiMocks.loadUsage.mockResolvedValue(usageReport);
  apiMocks.saveSettings.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("App chart hover behavior", () => {
  it("disables Recharts hover cursor background and uses themed tooltip styles", async () => {
    const { default: App } = await import("./App");

    render(<App />);

    await screen.findByText("rollout-chart-test");

    expect(rechartsMock.tooltips.length).toBeGreaterThan(0);
    expect(rechartsMock.tooltips.every((props) => props.cursor === false)).toBe(true);
    expect(rechartsMock.tooltips.every((props) => (props.contentStyle as { background?: string }).background === "var(--surface)")).toBe(true);
  });

  it("renders model token usage pie and switches token metric", async () => {
    apiMocks.loadUsage.mockResolvedValue(modelUsageReport);
    const { default: App } = await import("./App");

    render(<App />);

    await screen.findByText("model-chart-test");
    await screen.findByRole("heading", { name: "模型 Token 用量" });
    expect(screen.queryByRole("heading", { name: "Token 构成" })).toBeNull();

    const modelPanel = screen.getByRole("heading", { name: "模型 Token 用量" }).closest(".panel");
    expect(modelPanel).not.toBeNull();
    expect(within(modelPanel as HTMLElement).getByText("4.00M 总计")).toBeTruthy();
    expect(within(modelPanel as HTMLElement).getByText("2.34M")).toBeTruthy();

    let latestPie = rechartsMock.pies[rechartsMock.pies.length - 1];
    expect(latestPie.data).toEqual([
      { name: "gpt-5", value: 2_340_000 },
      { name: "gpt-5-mini", value: 1_110_000 },
      { name: "未知模型", value: 550_000 },
    ]);

    const latestTooltip = rechartsMock.tooltips[rechartsMock.tooltips.length - 1];
    expect((latestTooltip.formatter as (value: number) => string)(2_340_000)).toBe("2.34M");

    const metricTabs = screen.getByLabelText("模型 Token 用量指标");

    fireEvent.click(within(metricTabs).getByRole("button", { name: "输出" }));
    latestPie = rechartsMock.pies[rechartsMock.pies.length - 1];
    expect(latestPie.data).toEqual([
      { name: "gpt-5", value: 780_000 },
      { name: "gpt-5-mini", value: 330_000 },
      { name: "未知模型", value: 210_000 },
    ]);

    fireEvent.click(within(metricTabs).getByRole("button", { name: "缓存" }));
    latestPie = rechartsMock.pies[rechartsMock.pies.length - 1];
    expect(latestPie.data).toEqual([
      { name: "gpt-5", value: 800_000 },
      { name: "gpt-5-mini", value: 400_000 },
      { name: "未知模型", value: 200_000 },
    ]);
  });
});
