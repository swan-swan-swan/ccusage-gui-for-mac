// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
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

vi.mock("./lib/api", () => ({
  checkEnvironment: apiMocks.checkEnvironment,
  getSettings: apiMocks.getSettings,
  installCcusage: apiMocks.installCcusage,
  listSupportedTools: apiMocks.listSupportedTools,
  loadUsage: apiMocks.loadUsage,
  saveSettings: apiMocks.saveSettings,
}));

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
  ],
};

const millionUsageReport: RawUsageReport = {
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
      sessionId: "rollout-2026-06-29T09-39",
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

beforeEach(() => {
  apiMocks.checkEnvironment.mockResolvedValue(readyEnvironment);
  apiMocks.getSettings.mockResolvedValue(defaultSettings);
  apiMocks.installCcusage.mockResolvedValue({ success: true, stdout: "", stderr: "" });
  apiMocks.listSupportedTools.mockResolvedValue([
    { id: "claude", label: "Claude Code" },
    { id: "codex", label: "Codex" },
    { id: "gemini", label: "Gemini" },
  ]);
  apiMocks.loadUsage.mockResolvedValue(usageReport);
  apiMocks.saveSettings.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("App dashboard", () => {
  it("does not render the created time column", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "会话" });

    await waitFor(() => {
      expect(screen.queryByRole("columnheader", { name: "创建时间" })).toBeNull();
    });
  });

  it("renders daily trend as a bar chart", async () => {
    render(<App />);

    expect(await screen.findByRole("img", { name: "每日趋势柱状图" })).not.toBeNull();
  });

  it("shows million token conversions in summary cards and session rows", async () => {
    apiMocks.getSettings.mockResolvedValue({
      ...defaultSettings,
      lastTimeRangeId: "today",
    });
    apiMocks.loadUsage.mockResolvedValue(millionUsageReport);

    render(<App />);

    expect(await screen.findByText("1.13M")).not.toBeNull();
    expect(screen.getAllByText("0.10M").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("25.61M")).not.toBeNull();
    expect(screen.getAllByText("1.10M").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("25.52M")).not.toBeNull();
  });

  it("keeps navigation visible and scopes loading while usage data is loading", async () => {
    let resolveUsage: (value: RawUsageReport) => void = () => {};
    apiMocks.getSettings.mockResolvedValue({
      ...defaultSettings,
      lastTimeRangeId: "30d",
    });
    apiMocks.loadUsage.mockReturnValue(
      new Promise<RawUsageReport>((resolve) => {
        resolveUsage = resolve;
      }),
    );

    render(<App />);

    expect((await screen.findAllByText("正在加载 Codex 数据")).length).toBeGreaterThan(1);
    expect(screen.getAllByRole("progressbar", { name: "正在加载使用数据" }).length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: "当天" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Codex" })).not.toBeNull();
    expect(document.querySelector(".usage-loading-screen")).toBeNull();

    resolveUsage(usageReport);
    await screen.findByRole("heading", { name: "会话" });
  });

  it("keeps page controls available while changing time range", async () => {
    let resolveNextUsage: (value: RawUsageReport) => void = () => {};
    apiMocks.getSettings.mockResolvedValue({
      ...defaultSettings,
      lastTimeRangeId: "1d",
    });
    apiMocks.loadUsage
      .mockResolvedValueOnce(usageReport)
      .mockReturnValueOnce(
        new Promise<RawUsageReport>((resolve) => {
          resolveNextUsage = resolve;
        }),
      );

    render(<App />);

    expect(await screen.findByText("codex-6f78aa")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "最近 3 天" }));

    expect((await screen.findAllByText("正在加载 Codex 数据")).length).toBeGreaterThan(1);
    expect(screen.getAllByRole("progressbar", { name: "正在加载使用数据" }).length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: "最近 3 天" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Codex" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "设置" })).not.toBeNull();
    expect(document.querySelector(".usage-loading-screen")).toBeNull();

    resolveNextUsage(millionUsageReport);
    expect(await screen.findByText("rollout-2026-06-29T09-39")).not.toBeNull();
  });

  it("keeps page controls available while refreshing data", async () => {
    let resolveRefresh: (value: RawUsageReport) => void = () => {};
    apiMocks.getSettings.mockResolvedValue({
      ...defaultSettings,
      activeToolIds: ["gemini"],
      lastSelectedToolId: "gemini",
      lastTimeRangeId: "15d",
    });
    apiMocks.loadUsage
      .mockResolvedValueOnce(usageReport)
      .mockReturnValueOnce(
        new Promise<RawUsageReport>((resolve) => {
          resolveRefresh = resolve;
        }),
      );

    render(<App />);

    expect(await screen.findByText("codex-6f78aa")).not.toBeNull();
    fireEvent.click(screen.getByTitle("刷新数据"));

    expect((await screen.findAllByText("正在加载 Gemini 数据")).length).toBeGreaterThan(1);
    expect(screen.getAllByRole("progressbar", { name: "正在加载使用数据" }).length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: "当天" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Gemini" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "设置" })).not.toBeNull();
    expect(document.querySelector(".usage-loading-screen")).toBeNull();

    resolveRefresh(millionUsageReport);
    expect(await screen.findByText("rollout-2026-06-29T09-39")).not.toBeNull();
  });

  it("keeps page controls available while switching AI tools", async () => {
    let resolveNextToolUsage: (value: RawUsageReport) => void = () => {};
    apiMocks.getSettings.mockResolvedValue({
      ...defaultSettings,
      activeToolIds: ["claude", "gemini"],
      lastSelectedToolId: "claude",
    });
    apiMocks.loadUsage
      .mockResolvedValueOnce(usageReport)
      .mockReturnValueOnce(
        new Promise<RawUsageReport>((resolve) => {
          resolveNextToolUsage = resolve;
        }),
      );

    render(<App />);

    expect(await screen.findByText("codex-6f78aa")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Gemini" }));

    expect((await screen.findAllByText("正在加载 Gemini 数据")).length).toBeGreaterThan(1);
    expect(screen.getAllByRole("progressbar", { name: "正在加载使用数据" }).length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: "当天" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Gemini" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "设置" })).not.toBeNull();
    expect(document.querySelector(".usage-loading-screen")).toBeNull();

    resolveNextToolUsage(millionUsageReport);
    expect(await screen.findByText("rollout-2026-06-29T09-39")).not.toBeNull();
  });
});

describe("App settings", () => {
  it("places the settings action in the topbar instead of the tool rail", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "会话" });

    const settingsButton = screen.getByRole("button", { name: "设置" });
    const topbarActions = document.querySelector(".topbar-actions");
    const toolRail = document.querySelector(".tool-rail");

    expect(topbarActions?.contains(settingsButton)).toBe(true);
    expect(toolRail?.contains(settingsButton)).toBe(false);
  });

  it("opens settings as a full-page view with tabs and main page display controls", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "会话" });
    fireEvent.click(screen.getByRole("button", { name: "设置" }));

    expect(screen.getByRole("heading", { name: "设置" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: "通用" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: "AI 工具" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: "关于" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "界面语言" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "主页面显示" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Codex" })).not.toBeNull();
  });
});
