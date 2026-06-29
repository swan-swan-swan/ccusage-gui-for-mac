import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Check,
  ChevronsUpDown,
  Loader2,
  Monitor,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Sun,
  Terminal,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";
import { checkEnvironment, getSettings, installCcusage, listSupportedTools, loadUsage, saveSettings } from "./lib/api";
import { getEnvironmentAction } from "./lib/environment";
import { defaultSettings, normalizeSettings } from "./lib/settings";
import { createUsageCache } from "./lib/usageCache";
import { getSinceDate, timeRangeOptions } from "./lib/dateRanges";
import { getLanguageLabel, getSummaryCardLabels, getTimeRangeLabel, supportedLanguages, t } from "./lib/i18n";
import {
  buildModelTokenData,
  buildSessionRows,
  buildSummaryCards,
  buildTrendData,
  filterAndSortSessions,
  formatCurrency,
  formatInteger,
  formatMillionTokens,
  normalizeUsageReport,
} from "./lib/usage";
import type {
  AiTool,
  AppSettings,
  EnvironmentStatus,
  ModelTokenMetric,
  RawUsageReport,
  SessionSortKey,
  SessionTableState,
  TimeRangeId,
} from "./lib/types";

const usageCache = createUsageCache(loadUsage);
const chartColors = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#9333ea"];
const fallbackTools: AiTool[] = [{ id: "codex", label: "Codex" }];
const appVersion = "1.0.0";
type SettingsTab = "general" | "tools" | "about";
const chartTooltipProps = {
  cursor: false,
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--text)",
    boxShadow: "var(--shadow)",
  },
  itemStyle: {
    color: "var(--blue)",
  },
  labelStyle: {
    color: "var(--muted)",
  },
};

function App() {
  const [environment, setEnvironment] = useState<EnvironmentStatus | null>(null);
  const [tools, setTools] = useState<AiTool[]>(fallbackTools);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const language = settings.language;
  const [selectedToolId, setSelectedToolId] = useState(defaultSettings.lastSelectedToolId ?? "codex");
  const [timeRangeId, setTimeRangeId] = useState<TimeRangeId>(defaultSettings.lastTimeRangeId);
  const [rawReport, setRawReport] = useState<RawUsageReport | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isUsageLoading, setIsUsageLoading] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [modelTokenMetric, setModelTokenMetric] = useState<ModelTokenMetric>("input");
  const [tableState, setTableState] = useState<SessionTableState>({
    query: "",
    sortKey: "lastActivity",
    sortDirection: "desc",
  });

  const environmentAction = environment ? getEnvironmentAction(environment) : "node-required";
  const activeTools = useMemo(
    () => tools.filter((tool) => settings.activeToolIds.includes(tool.id)),
    [settings.activeToolIds, tools],
  );
  const selectedTool = tools.find((tool) => tool.id === selectedToolId) ?? activeTools[0] ?? tools[0];
  const since = getSinceDate(timeRangeId);
  const report = useMemo(() => normalizeUsageReport(rawReport ?? { totals: {}, sessions: [] }), [rawReport]);
  const summaryCards = useMemo(() => buildSummaryCards(report.summary, getSummaryCardLabels(language)), [language, report.summary]);
  const trendData = useMemo(() => buildTrendData(report.sessions), [report.sessions]);
  const modelTokenData = useMemo(
    () => buildModelTokenData(report.sessions, modelTokenMetric, t(language, "unknownModel")),
    [language, modelTokenMetric, report.sessions],
  );
  const modelTokenTotal = useMemo(
    () => modelTokenData.reduce((total, item) => total + item.value, 0),
    [modelTokenData],
  );
  const sessionRows = useMemo(() => buildSessionRows(report.sessions), [report.sessions]);
  const visibleRows = useMemo(() => filterAndSortSessions(sessionRows, tableState), [sessionRows, tableState]);
  const usageLoadingLabel = t(language, "loadingUsageData", { tool: selectedTool?.label ?? t(language, "aiTools") });
  const modelTokenMetricOptions: Array<{ id: ModelTokenMetric; label: string }> = [
    { id: "input", label: t(language, "input") },
    { id: "output", label: t(language, "output") },
    { id: "cache", label: t(language, "cache") },
  ];

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.themeMode;
  }, [settings.themeMode]);

  useEffect(() => {
    if (environmentAction !== "ready" || !selectedTool?.id) {
      setRawReport(null);
      return;
    }

    void loadSelectedUsage(false);
  }, [environmentAction, selectedTool?.id, since]);

  async function initialize() {
    setIsInitializing(true);
    setError(null);

    try {
      const envStatus = await checkEnvironment();
      setEnvironment(envStatus);

      const discoveredTools = envStatus.ccusageInstalled ? await loadToolsSafely() : fallbackTools;
      setTools(discoveredTools.length > 0 ? discoveredTools : fallbackTools);

      const storedSettings = await getSettings().catch(() => defaultSettings);
      const normalized = normalizeSettings(storedSettings, discoveredTools.map((tool) => tool.id));
      applySettings(normalized);
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setIsInitializing(false);
    }
  }

  async function loadToolsSafely(): Promise<AiTool[]> {
    try {
      return await listSupportedTools();
    } catch {
      return fallbackTools;
    }
  }

  function applySettings(nextSettings: AppSettings) {
    setSettings(nextSettings);
    setSelectedToolId(nextSettings.lastSelectedToolId ?? nextSettings.activeToolIds[0] ?? "codex");
    setTimeRangeId(nextSettings.lastTimeRangeId);
  }

  async function commitSettings(nextSettings: AppSettings) {
    applySettings(nextSettings);
    await saveSettings(nextSettings).catch((caught) => setError(toErrorMessage(caught)));
  }

  async function loadSelectedUsage(refresh: boolean) {
    if (!selectedTool?.id) {
      return;
    }

    setIsUsageLoading(true);
    setError(null);

    try {
      const usage = await usageCache.load(selectedTool.id, since, { refresh });
      setRawReport(usage);
    } catch (caught) {
      setRawReport(null);
      setError(toErrorMessage(caught));
    } finally {
      setIsUsageLoading(false);
    }
  }

  async function handleInstallCcusage() {
    setIsInstalling(true);
    setError(null);

    try {
      const result = await installCcusage();
      if (!result.success) {
      throw new Error(result.stderr || result.stdout || "ccusage installation failed");
      }

      await initialize();
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setIsInstalling(false);
    }
  }

  async function handleTimeRangeChange(nextTimeRangeId: TimeRangeId) {
    if (nextTimeRangeId === timeRangeId) {
      return;
    }

    setIsUsageLoading(true);
    setError(null);

    await commitSettings({
      ...settings,
      lastTimeRangeId: nextTimeRangeId,
    });
  }

  async function handleSelectTool(toolId: string) {
    if (toolId === selectedToolId) {
      return;
    }

    setIsUsageLoading(true);
    setError(null);

    await commitSettings({
      ...settings,
      lastSelectedToolId: toolId,
    });
  }

  async function handleToggleTool(toolId: string) {
    const isActive = settings.activeToolIds.includes(toolId);
    const nextActiveToolIds = isActive
      ? settings.activeToolIds.filter((id) => id !== toolId)
      : [...settings.activeToolIds, toolId];

    if (nextActiveToolIds.length === 0) {
      return;
    }

    const nextSelectedToolId = nextActiveToolIds.includes(selectedToolId) ? selectedToolId : nextActiveToolIds[0];

    await commitSettings({
      ...settings,
      activeToolIds: nextActiveToolIds,
      lastSelectedToolId: nextSelectedToolId,
    });
  }

  async function handleLanguageChange(nextLanguage: AppSettings["language"]) {
    await commitSettings({
      ...settings,
      language: nextLanguage,
    });
  }

  async function handleThemeChange(nextThemeMode: AppSettings["themeMode"]) {
    await commitSettings({
      ...settings,
      themeMode: nextThemeMode,
    });
  }

  function handleSort(sortKey: SessionSortKey) {
    setTableState((current) => ({
      ...current,
      sortKey,
      sortDirection: current.sortKey === sortKey && current.sortDirection === "desc" ? "asc" : "desc",
    }));
  }

  if (isSettingsOpen) {
    return (
      <SettingsScreen
        activeToolIds={settings.activeToolIds}
        language={language}
        onClose={() => setIsSettingsOpen(false)}
        onLanguageChange={handleLanguageChange}
        onThemeChange={handleThemeChange}
        onToggleTool={handleToggleTool}
        themeMode={settings.themeMode}
        tools={tools}
      />
    );
  }

  if (isUsageLoading) {
    return (
      <main className="usage-loading-screen">
        <UsageLoadingPanel label={usageLoadingLabel} progressLabel={t(language, "usageLoadingAria")} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="tool-rail">
        <div className="brand">
          <Terminal size={20} aria-hidden="true" />
          <span>ccusage</span>
        </div>
        <nav className="tool-list" aria-label={t(language, "aiTools")}>
          {activeTools.map((tool) => (
            <button
              className={tool.id === selectedTool?.id ? "tool-button active" : "tool-button"}
              key={tool.id}
              onClick={() => void handleSelectTool(tool.id)}
              type="button"
            >
              {tool.label}
            </button>
          ))}
        </nav>
        <button className="icon-text-button rail-settings" onClick={() => setIsSettingsOpen(true)} type="button">
          <Settings size={16} aria-hidden="true" />
          {t(language, "settings")}
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{selectedTool?.label ?? "AI Tool"}</p>
            <h1>{t(language, "tokenUsage")}</h1>
          </div>
          <div className="topbar-actions">
            <div className="range-control" aria-label="Time range">
              {timeRangeOptions.map((option) => (
                <button
                  className={option.id === timeRangeId ? "active" : ""}
                  key={option.id}
                  onClick={() => void handleTimeRangeChange(option.id)}
                  type="button"
                >
                  {getTimeRangeLabel(language, option.id)}
                </button>
              ))}
            </div>
            <button
              className="icon-button"
              disabled={environmentAction !== "ready" || isUsageLoading}
              onClick={() => void loadSelectedUsage(true)}
              title={t(language, "refreshData")}
              type="button"
            >
              <RefreshCw className={isUsageLoading ? "spin" : ""} size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {error ? (
          <div className="notice error">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {isInitializing ? (
          <StatePanel icon={<Loader2 className="spin" size={22} />} title={t(language, "loadingEnvironment")} />
        ) : environmentAction === "node-required" ? (
          <StatePanel
            icon={<AlertCircle size={22} />}
            title={t(language, "nodeRequired")}
            detail={
              environment?.nodeVersion
                ? t(language, "nodeDetected", { version: environment.nodeVersion })
                : t(language, "nodeNotFound")
            }
          />
        ) : environmentAction === "install-ccusage" ? (
          <InstallPanel isInstalling={isInstalling} language={language} onInstall={handleInstallCcusage} />
        ) : isUsageLoading ? (
          <UsageLoadingPanel label={usageLoadingLabel} progressLabel={t(language, "usageLoadingAria")} />
        ) : (
          <>
                <section className="summary-grid">
                  {summaryCards.map((card) => (
                    <article className={`summary-card ${card.tone}`} key={card.id}>
                      <span>{card.label}</span>
                      <div className="summary-value-row">
                        <strong>{card.value}</strong>
                        {card.millionValue ? <span className="million-badge">{card.millionValue}</span> : null}
                      </div>
                      {card.id === "cache" ? (
                        <small>
                          {t(language, "cacheBreakdown", {
                            create: formatInteger(report.summary.cacheCreationTokens),
                            read: formatInteger(report.summary.cacheReadTokens),
                          })}
                        </small>
                      ) : null}
                    </article>
                  ))}
                </section>

                <section className="chart-grid">
                  <div className="panel">
                    <div className="panel-header">
                      <h2>{t(language, "dailyTrend")}</h2>
                      <span>{since}</span>
                    </div>
                    <div className="chart-frame" role={trendData.length > 0 ? "img" : undefined} aria-label={trendData.length > 0 ? t(language, "dailyTrendBarChart") : undefined}>
                      {trendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <BarChart data={trendData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} />
                            <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompactNumber} />
                            <Tooltip {...chartTooltipProps} formatter={(value) => formatInteger(Number(value))} />
                            <Bar dataKey="tokens" fill="#2563eb" maxBarSize={44} radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyState label={t(language, "noTrendData")} />
                      )}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-header model-token-header">
                      <div>
                        <h2>{t(language, "modelTokenUsage")}</h2>
                        <span>
                          {formatMillionTokens(modelTokenTotal)} {t(language, "total")}
                        </span>
                      </div>
                      <div className="metric-tabs" aria-label={t(language, "modelTokenMetricAria")}>
                        {modelTokenMetricOptions.map((option) => (
                          <button
                            className={option.id === modelTokenMetric ? "active" : ""}
                            key={option.id}
                            onClick={() => setModelTokenMetric(option.id)}
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="chart-frame">
                      {modelTokenData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <PieChart>
                            <Pie
                              data={modelTokenData}
                              dataKey="value"
                              innerRadius={58}
                              outerRadius={92}
                              paddingAngle={2}
                              nameKey="name"
                            >
                              {modelTokenData.map((item, index) => (
                                <Cell fill={chartColors[index % chartColors.length]} key={item.name} />
                              ))}
                            </Pie>
                            <Tooltip {...chartTooltipProps} formatter={(value) => formatMillionTokens(Number(value))} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyState label={t(language, "noTokenData")} />
                      )}
                    </div>
                    <div className="composition-legend model-token-legend">
                      {modelTokenData.map((item, index) => (
                        <span key={item.name}>
                          <i style={{ background: chartColors[index % chartColors.length] }} />
                          {item.name}
                          <small>{formatMillionTokens(item.value)}</small>
                        </span>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="panel table-panel">
                  <div className="panel-header table-header">
                    <div>
                      <h2>{t(language, "sessions")}</h2>
                      <span>{t(language, "shown", { count: visibleRows.length })}</span>
                    </div>
                    <label className="search-box">
                      <Search size={16} aria-hidden="true" />
                      <input
                        onChange={(event) => setTableState((current) => ({ ...current, query: event.target.value }))}
                        placeholder={t(language, "searchSessionId")}
                        value={tableState.query}
                      />
                    </label>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{t(language, "sessionId")}</th>
                          <th>
                            <SortButton active={tableState.sortKey === "inputTokens"} onClick={() => handleSort("inputTokens")}>
                              {t(language, "input")}
                            </SortButton>
                          </th>
                          <th>
                            <SortButton active={tableState.sortKey === "outputTokens"} onClick={() => handleSort("outputTokens")}>
                              {t(language, "output")}
                            </SortButton>
                          </th>
                          <th>{t(language, "cache")}</th>
                          <th>{t(language, "cost")}</th>
                          <th>
                            <SortButton active={tableState.sortKey === "lastActivity"} onClick={() => handleSort("lastActivity")}>
                              {t(language, "lastActive")}
                            </SortButton>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((session) => (
                          <tr key={session.sessionId}>
                            <td>
                              <code>{session.sessionId}</code>
                              {session.directory ? <small>{session.directory}</small> : null}
                            </td>
                            <td>
                              <TokenAmount value={session.inputTokens} />
                            </td>
                            <td>
                              <TokenAmount value={session.outputTokens} />
                            </td>
                            <td>
                              <TokenAmount
                                detail={`${formatInteger(session.cacheCreationTokens)} / ${formatInteger(session.cacheReadTokens)}`}
                                value={session.cacheTokens}
                              />
                            </td>
                            <td>{formatCurrency(session.costUSD)}</td>
                            <td>{session.lastActivityLabel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {visibleRows.length === 0 ? <EmptyState label={t(language, "noSessions")} /> : null}
                  </div>
                </section>
          </>
        )}
      </section>
    </main>
  );
}

function TokenAmount({ detail, value }: { detail?: string; value: number }) {
  return (
    <span className="token-amount">
      <span className="token-exact">{formatInteger(value)}</span>
      <span className="token-million">{formatMillionTokens(value)}</span>
      {detail ? <small>{detail}</small> : null}
    </span>
  );
}

function InstallPanel({
  isInstalling,
  language,
  onInstall,
}: {
  isInstalling: boolean;
  language: AppSettings["language"];
  onInstall: () => void;
}) {
  return (
    <div className="install-panel">
      <Terminal size={26} aria-hidden="true" />
      <h2>{t(language, "installCcusage")}</h2>
      <code>npm install -g ccusage</code>
      <button className="primary-button" disabled={isInstalling} onClick={onInstall} type="button">
        {isInstalling ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
        {t(language, "install")}
      </button>
    </div>
  );
}

function SettingsScreen({
  activeToolIds,
  language,
  onClose,
  onLanguageChange,
  onThemeChange,
  onToggleTool,
  themeMode,
  tools,
}: {
  activeToolIds: string[];
  language: AppSettings["language"];
  onClose: () => void;
  onLanguageChange: (language: AppSettings["language"]) => void;
  onThemeChange: (themeMode: AppSettings["themeMode"]) => void;
  onToggleTool: (toolId: string) => void;
  themeMode: AppSettings["themeMode"];
  tools: AiTool[];
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: "general", label: t(language, "general") },
    { id: "tools", label: t(language, "aiTools") },
    { id: "about", label: t(language, "about") },
  ];

  return (
    <main className="settings-screen">
      <header className="settings-topbar">
        <button className="settings-back-button" onClick={onClose} title={t(language, "closeSettings")} type="button">
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <h1>{t(language, "settings")}</h1>
      </header>

      <div className="settings-tabs" role="tablist" aria-label={t(language, "settings")}>
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="settings-content" role="tabpanel">
        {activeTab === "general" ? (
          <GeneralSettings
            activeToolIds={activeToolIds}
            language={language}
            onLanguageChange={onLanguageChange}
            onThemeChange={onThemeChange}
            onToggleTool={onToggleTool}
            themeMode={themeMode}
            tools={tools}
          />
        ) : null}
        {activeTab === "tools" ? (
          <ToolSettings activeToolIds={activeToolIds} language={language} onToggleTool={onToggleTool} tools={tools} />
        ) : null}
        {activeTab === "about" ? <AboutSettings language={language} /> : null}
      </section>
    </main>
  );
}

function GeneralSettings({
  activeToolIds,
  language,
  onLanguageChange,
  onThemeChange,
  onToggleTool,
  themeMode,
  tools,
}: {
  activeToolIds: string[];
  language: AppSettings["language"];
  onLanguageChange: (language: AppSettings["language"]) => void;
  onThemeChange: (themeMode: AppSettings["themeMode"]) => void;
  onToggleTool: (toolId: string) => void;
  themeMode: AppSettings["themeMode"];
  tools: AiTool[];
}) {
  const themeOptions = [
    { id: "light" as const, label: t(language, "light"), icon: <Sun size={18} aria-hidden="true" /> },
    { id: "dark" as const, label: t(language, "dark"), icon: <Moon size={18} aria-hidden="true" /> },
    { id: "system" as const, label: t(language, "system"), icon: <Monitor size={18} aria-hidden="true" /> },
  ];

  return (
    <div className="settings-stack">
      <SettingsBlock title={t(language, "interfaceLanguage")} detail={t(language, "interfaceLanguageDetail")}>
        <div className="settings-segmented language-options">
          {supportedLanguages.map((item) => (
            <button
              className={item === language ? "active" : ""}
              key={item}
              onClick={() => onLanguageChange(item)}
              type="button"
            >
              {getLanguageLabel(item)}
            </button>
          ))}
        </div>
      </SettingsBlock>

      <SettingsBlock title={t(language, "appearanceTheme")} detail={t(language, "appearanceThemeDetail")}>
        <div className="settings-segmented theme-options">
          {themeOptions.map((item) => (
            <button
              className={item.id === themeMode ? "active" : ""}
              key={item.id}
              onClick={() => onThemeChange(item.id)}
              type="button"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </SettingsBlock>

      <SettingsBlock title={t(language, "mainPageDisplay")} detail={t(language, "mainPageDisplayDetail")}>
        <div className="settings-tool-pills">
          {tools.map((tool) => (
            <button
              aria-pressed={activeToolIds.includes(tool.id)}
              className={activeToolIds.includes(tool.id) ? "active" : ""}
              key={tool.id}
              onClick={() => onToggleTool(tool.id)}
              type="button"
            >
              {tool.label}
            </button>
          ))}
        </div>
      </SettingsBlock>
    </div>
  );
}

function ToolSettings({
  activeToolIds,
  language,
  onToggleTool,
  tools,
}: {
  activeToolIds: string[];
  language: AppSettings["language"];
  onToggleTool: (toolId: string) => void;
  tools: AiTool[];
}) {
  return (
    <div className="settings-stack">
      <SettingsBlock title={t(language, "aiTools")} detail={t(language, "aiToolsDetail")}>
        <div className="settings-tool-grid">
          {tools.map((tool) => (
            <label className={activeToolIds.includes(tool.id) ? "active" : ""} key={tool.id}>
              <input checked={activeToolIds.includes(tool.id)} onChange={() => onToggleTool(tool.id)} type="checkbox" />
              <span>{tool.label}</span>
            </label>
          ))}
        </div>
      </SettingsBlock>
    </div>
  );
}

function AboutSettings({ language }: { language: AppSettings["language"] }) {
  return (
    <div className="settings-stack">
      <SettingsBlock title={t(language, "appName")}>
        <div className="about-panel">
          <BarChart3 size={28} aria-hidden="true" />
          <strong>{t(language, "appName")}</strong>
          <span>
            {t(language, "version")} {appVersion}
          </span>
        </div>
      </SettingsBlock>
    </div>
  );
}

function SettingsBlock({
  children,
  detail,
  title,
}: {
  children: React.ReactNode;
  detail?: string;
  title: string;
}) {
  return (
    <section className="settings-block">
      <h2>{title}</h2>
      {detail ? <p>{detail}</p> : null}
      {children}
    </section>
  );
}

function UsageLoadingPanel({ label, progressLabel }: { label: string; progressLabel: string }) {
  return (
    <div className="usage-loading-panel">
      <div>
        <Loader2 className="spin" size={28} aria-hidden="true" />
        <h2>{label}</h2>
      </div>
      <div aria-label={progressLabel} className="loading-progress" role="progressbar" />
    </div>
  );
}

function SortButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button className={active ? "sort-button active" : "sort-button"} onClick={onClick} type="button">
      {children}
      <ChevronsUpDown size={14} aria-hidden="true" />
    </button>
  );
}

function StatePanel({ detail, icon, title }: { detail?: string; icon: React.ReactNode; title: string }) {
  return (
    <div className="state-panel">
      {icon}
      <h2>{title}</h2>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="empty-state">{label}</div>;
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }

  return `${value}`;
}

function toErrorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

export default App;
