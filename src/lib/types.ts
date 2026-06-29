export type TimeRangeId = "today" | "1d" | "3d" | "7d" | "15d" | "30d";
export type Language = "zh-CN" | "en-US";
export type ThemeMode = "light" | "dark" | "system";

export interface TimeRangeOption {
  id: TimeRangeId;
  label: string;
  daysBack: number;
}

export interface AiTool {
  id: string;
  label: string;
}

export interface RawTokenTotals {
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheCreationTokens?: number | null;
  cacheReadTokens?: number | null;
  reasoningOutputTokens?: number | null;
  totalTokens?: number | null;
  costUSD?: number | null;
}

export interface RawSessionUsage extends RawTokenTotals {
  sessionId?: string | null;
  directory?: string | null;
  lastActivity?: string | null;
  createdAt?: string | null;
  sessionFile?: string | null;
  models?: Record<string, RawTokenTotals>;
}

export interface RawUsageReport {
  totals?: RawTokenTotals | null;
  sessions?: RawSessionUsage[] | null;
}

export interface UsageSummary {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cacheTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  costUSD: number;
}

export interface SessionUsage {
  sessionId: string;
  directory: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cacheTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  costUSD: number;
  createdAt: string | null;
  lastActivity: string | null;
  sessionFile: string | null;
  models: Record<string, RawTokenTotals>;
}

export interface UsageReport {
  summary: UsageSummary;
  sessions: SessionUsage[];
}

export interface SummaryCard {
  id: "input" | "output" | "cache" | "cost";
  label: string;
  value: string;
  millionValue?: string;
  tone: "blue" | "green" | "amber" | "violet";
}

export interface SummaryCardLabels {
  input: string;
  output: string;
  cache: string;
  cost: string;
}

export interface CompositionDatum {
  name: "Input" | "Output" | "Cache";
  value: number;
}

export type ModelTokenMetric = "input" | "output" | "cache";

export interface ModelTokenDatum {
  name: string;
  value: number;
}

export interface TrendDatum {
  date: string;
  tokens: number;
  costUSD: number;
}

export interface SessionUsageRow extends SessionUsage {
  lastActivityLabel: string;
}

export type SessionSortKey = "lastActivity" | "inputTokens" | "outputTokens";
export type SortDirection = "asc" | "desc";

export interface SessionTableState {
  query: string;
  sortKey: SessionSortKey;
  sortDirection: SortDirection;
}

export interface EnvironmentStatus {
  nodeInstalled: boolean;
  nodeVersion: string | null;
  nodeMajor: number | null;
  nodeMeetsRequirement: boolean;
  ccusageInstalled: boolean;
  ccusageVersion: string | null;
}

export interface InstallResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

export interface AppSettings {
  activeToolIds: string[];
  lastSelectedToolId: string | null;
  lastTimeRangeId: TimeRangeId;
  themeMode: ThemeMode;
  language: Language;
}
