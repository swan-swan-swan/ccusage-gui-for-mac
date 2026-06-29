import type { Language, SummaryCardLabels, TimeRangeId } from "./types";

export const supportedLanguages: Language[] = ["zh-CN", "en-US"];

export type TranslationKey =
  | "about"
  | "aiTools"
  | "aiToolsDetail"
  | "appearanceTheme"
  | "appearanceThemeDetail"
  | "appName"
  | "cache"
  | "cacheBreakdown"
  | "cacheTokens"
  | "closeSettings"
  | "cost"
  | "dailyTrend"
  | "dailyTrendBarChart"
  | "dark"
  | "estimatedCost"
  | "general"
  | "input"
  | "inputTokens"
  | "install"
  | "installCcusage"
  | "interfaceLanguage"
  | "interfaceLanguageDetail"
  | "language"
  | "lastActive"
  | "light"
  | "loadingEnvironment"
  | "loadingUsageData"
  | "mainPageDisplay"
  | "mainPageDisplayDetail"
  | "modelTokenMetricAria"
  | "modelTokenUsage"
  | "noSessions"
  | "noTokenData"
  | "noTrendData"
  | "nodeDetected"
  | "nodeNotFound"
  | "nodeRequired"
  | "output"
  | "outputTokens"
  | "refreshData"
  | "searchSessionId"
  | "sessionId"
  | "sessions"
  | "settings"
  | "shown"
  | "system"
  | "theme"
  | "tokenMix"
  | "tokenUsage"
  | "total"
  | "usageLoadingAria"
  | "usageStats"
  | "unknownModel"
  | "version";

const translations: Record<Language, Record<TranslationKey, string>> = {
  "zh-CN": {
    about: "关于",
    aiTools: "AI 工具",
    aiToolsDetail: "选择要在侧边栏和主页中使用的工具。",
    appearanceTheme: "外观主题",
    appearanceThemeDetail: "选择应用的外观主题，立即生效。",
    appName: "CCusage GUI",
    cache: "缓存",
    cacheBreakdown: "创建 {create} / 读取 {read}",
    cacheTokens: "缓存 Token",
    closeSettings: "关闭设置",
    cost: "成本",
    dailyTrend: "每日趋势",
    dailyTrendBarChart: "每日趋势柱状图",
    dark: "深色",
    estimatedCost: "预估成本",
    general: "通用",
    input: "输入",
    inputTokens: "输入 Token",
    install: "安装",
    installCcusage: "安装 ccusage",
    interfaceLanguage: "界面语言",
    interfaceLanguageDetail: "切换后立即预览界面语言，保存后永久生效。",
    language: "语言",
    lastActive: "最后活跃",
    light: "浅色",
    loadingEnvironment: "正在检查运行环境",
    loadingUsageData: "正在加载 {tool} 数据",
    mainPageDisplay: "主页面显示",
    mainPageDisplayDetail: "选择在主页面显示的应用。",
    modelTokenMetricAria: "模型 Token 用量指标",
    modelTokenUsage: "模型 Token 用量",
    noSessions: "暂无会话",
    noTokenData: "暂无 Token 数据",
    noTrendData: "暂无趋势数据",
    nodeDetected: "检测到 {version}",
    nodeNotFound: "未找到 Node.js",
    nodeRequired: "需要 Node.js v20+",
    output: "输出",
    outputTokens: "输出 Token",
    refreshData: "刷新数据",
    searchSessionId: "搜索 session id",
    sessionId: "Session ID",
    sessions: "会话",
    settings: "设置",
    shown: "已显示 {count} 条",
    system: "跟随系统",
    theme: "主题",
    tokenMix: "Token 构成",
    tokenUsage: "Token 用量",
    total: "总计",
    usageLoadingAria: "正在加载使用数据",
    usageStats: "使用统计",
    unknownModel: "未知模型",
    version: "版本",
  },
  "en-US": {
    about: "About",
    aiTools: "AI Tools",
    aiToolsDetail: "Choose the tools available in the sidebar and dashboard.",
    appearanceTheme: "Appearance Theme",
    appearanceThemeDetail: "Choose the app appearance theme. Changes apply immediately.",
    appName: "CCusage GUI",
    cache: "Cache",
    cacheBreakdown: "Create {create} / Read {read}",
    cacheTokens: "Cache Tokens",
    closeSettings: "Close settings",
    cost: "Cost",
    dailyTrend: "Daily Trend",
    dailyTrendBarChart: "Daily trend bar chart",
    dark: "Dark",
    estimatedCost: "Estimated Cost",
    general: "General",
    input: "Input",
    inputTokens: "Input Tokens",
    install: "Install",
    installCcusage: "Install ccusage",
    interfaceLanguage: "Interface Language",
    interfaceLanguageDetail: "Preview the interface language immediately and keep it after saving.",
    language: "Language",
    lastActive: "Last Active",
    light: "Light",
    loadingEnvironment: "Loading environment",
    loadingUsageData: "Loading {tool} data",
    mainPageDisplay: "Home Page Display",
    mainPageDisplayDetail: "Choose the apps shown on the main page.",
    modelTokenMetricAria: "Model token usage metric",
    modelTokenUsage: "Model Token Usage",
    noSessions: "No sessions",
    noTokenData: "No token data",
    noTrendData: "No trend data",
    nodeDetected: "Detected {version}",
    nodeNotFound: "Node.js was not found",
    nodeRequired: "Node.js v20+ required",
    output: "Output",
    outputTokens: "Output Tokens",
    refreshData: "Refresh data",
    searchSessionId: "Search session id",
    sessionId: "Session ID",
    sessions: "Sessions",
    settings: "Settings",
    shown: "{count} shown",
    system: "System",
    theme: "Theme",
    tokenMix: "Token Mix",
    tokenUsage: "Token Usage",
    total: "total",
    usageLoadingAria: "Loading usage data",
    usageStats: "Usage Stats",
    unknownModel: "Unknown Model",
    version: "Version",
  },
};

const timeRangeLabels: Record<Language, Record<TimeRangeId, string>> = {
  "zh-CN": {
    today: "当天",
    "1d": "最近 1 天",
    "3d": "最近 3 天",
    "7d": "最近 7 天",
    "15d": "最近 15 天",
    "30d": "最近 30 天",
  },
  "en-US": {
    today: "Today",
    "1d": "Last 1 day",
    "3d": "Last 3 days",
    "7d": "Last 7 days",
    "15d": "Last 15 days",
    "30d": "Last 30 days",
  },
};

const languageLabels: Record<Language, string> = {
  "zh-CN": "简体中文",
  "en-US": "English",
};

export function t(language: Language, key: TranslationKey, params: Record<string, string | number> = {}): string {
  return Object.entries(params).reduce(
    (message, [paramKey, value]) => message.replace(`{${paramKey}}`, String(value)),
    translations[language][key],
  );
}

export function getTimeRangeLabel(language: Language, rangeId: TimeRangeId): string {
  return timeRangeLabels[language][rangeId];
}

export function getLanguageLabel(language: Language): string {
  return languageLabels[language];
}

export function getSummaryCardLabels(language: Language): SummaryCardLabels {
  return {
    input: t(language, "inputTokens"),
    output: t(language, "outputTokens"),
    cache: t(language, "cacheTokens"),
    cost: t(language, "estimatedCost"),
  };
}
