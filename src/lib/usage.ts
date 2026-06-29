import type {
  CompositionDatum,
  ModelTokenDatum,
  ModelTokenMetric,
  RawSessionUsage,
  RawTokenTotals,
  RawUsageReport,
  SessionTableState,
  SessionUsage,
  SessionUsageRow,
  SummaryCard,
  SummaryCardLabels,
  TrendDatum,
  UsageReport,
  UsageSummary,
} from "./types";

export function normalizeUsageReport(rawReport: RawUsageReport): UsageReport {
  return {
    summary: normalizeSummary(rawReport.totals ?? {}),
    sessions: (rawReport.sessions ?? []).map(normalizeSession),
  };
}

const defaultSummaryCardLabels: SummaryCardLabels = {
  input: "Input Tokens",
  output: "Output Tokens",
  cache: "Cache Tokens",
  cost: "Estimated Cost",
};

export function buildSummaryCards(summary: UsageSummary, labels = defaultSummaryCardLabels): SummaryCard[] {
  return [
    {
      id: "input",
      label: labels.input,
      value: formatInteger(summary.inputTokens),
      millionValue: formatMillionTokens(summary.inputTokens),
      tone: "blue",
    },
    {
      id: "output",
      label: labels.output,
      value: formatInteger(summary.outputTokens),
      millionValue: formatMillionTokens(summary.outputTokens),
      tone: "green",
    },
    {
      id: "cache",
      label: labels.cache,
      value: formatInteger(summary.cacheTokens),
      millionValue: formatMillionTokens(summary.cacheTokens),
      tone: "amber",
    },
    { id: "cost", label: labels.cost, value: formatCurrency(summary.costUSD), tone: "violet" },
  ];
}

export function buildCompositionData(summary: UsageSummary): CompositionDatum[] {
  return [
    { name: "Input", value: summary.inputTokens },
    { name: "Output", value: summary.outputTokens },
    { name: "Cache", value: summary.cacheTokens },
  ];
}

export function buildModelTokenData(
  sessions: SessionUsage[],
  metric: ModelTokenMetric,
  unknownModelLabel = "Unknown Model",
): ModelTokenDatum[] {
  const grouped = new Map<string, number>();

  sessions.forEach((session) => {
    const modelEntries = Object.entries(session.models);

    if (modelEntries.length === 0) {
      addModelMetric(grouped, unknownModelLabel, getSessionMetricValue(session, metric));
      return;
    }

    modelEntries.forEach(([modelName, rawTotals]) => {
      const modelSummary = normalizeSummary(rawTotals);
      const label = modelName.trim() || unknownModelLabel;
      addModelMetric(grouped, label, getSummaryMetricValue(modelSummary, metric));
    });
  });

  return Array.from(grouped.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name));
}

export function buildTrendData(sessions: SessionUsage[]): TrendDatum[] {
  const grouped = new Map<string, TrendDatum>();

  sessions.forEach((session) => {
    if (!session.lastActivity) {
      return;
    }

    const date = session.lastActivity.slice(0, 10);
    const existing = grouped.get(date) ?? { date, tokens: 0, costUSD: 0 };
    existing.tokens += session.totalTokens;
    existing.costUSD += session.costUSD;
    grouped.set(date, existing);
  });

  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function buildSessionRows(sessions: SessionUsage[]): SessionUsageRow[] {
  return sessions.map((session) => ({
    ...session,
    lastActivityLabel: formatDateTime(session.lastActivity),
  }));
}

export function filterAndSortSessions(
  sessions: SessionUsageRow[],
  state: SessionTableState,
): SessionUsageRow[] {
  const query = state.query.trim().toLowerCase();
  const filtered = query
    ? sessions.filter((session) => session.sessionId.toLowerCase().includes(query))
    : sessions;

  return [...filtered].sort((left, right) => {
    const result = compareSessionValue(left, right, state.sortKey);
    return state.sortDirection === "asc" ? result : -result;
  });
}

export function formatInteger(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function formatMillionTokens(value: number): string {
  return `${(value / 1_000_000).toFixed(2)}M`;
}

export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeSummary(raw: RawTokenTotals): UsageSummary {
  const inputTokens = toNumber(raw.inputTokens);
  const outputTokens = toNumber(raw.outputTokens);
  const cacheCreationTokens = toNumber(raw.cacheCreationTokens);
  const cacheReadTokens = toNumber(raw.cacheReadTokens);
  const reasoningOutputTokens = toNumber(raw.reasoningOutputTokens);
  const totalTokens = toNumber(raw.totalTokens) || inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;

  return {
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    cacheTokens: cacheCreationTokens + cacheReadTokens,
    reasoningOutputTokens,
    totalTokens,
    costUSD: toNumber(raw.costUSD),
  };
}

function normalizeSession(raw: RawSessionUsage): SessionUsage {
  const summary = normalizeSummary(raw);

  return {
    sessionId: raw.sessionId ?? "unknown-session",
    directory: raw.directory ?? null,
    inputTokens: summary.inputTokens,
    outputTokens: summary.outputTokens,
    cacheCreationTokens: summary.cacheCreationTokens,
    cacheReadTokens: summary.cacheReadTokens,
    cacheTokens: summary.cacheTokens,
    reasoningOutputTokens: summary.reasoningOutputTokens,
    totalTokens: summary.totalTokens,
    costUSD: summary.costUSD,
    createdAt: raw.createdAt ?? null,
    lastActivity: raw.lastActivity ?? null,
    sessionFile: raw.sessionFile ?? null,
    models: raw.models ?? {},
  };
}

function compareSessionValue(left: SessionUsageRow, right: SessionUsageRow, key: SessionTableState["sortKey"]): number {
  if (key === "lastActivity") {
    return (Date.parse(left.lastActivity ?? "") || 0) - (Date.parse(right.lastActivity ?? "") || 0);
  }

  return left[key] - right[key];
}

function addModelMetric(grouped: Map<string, number>, modelName: string, value: number) {
  grouped.set(modelName, (grouped.get(modelName) ?? 0) + value);
}

function getSessionMetricValue(session: SessionUsage, metric: ModelTokenMetric): number {
  if (metric === "input") {
    return session.inputTokens;
  }

  if (metric === "output") {
    return session.outputTokens;
  }

  return session.cacheTokens;
}

function getSummaryMetricValue(summary: UsageSummary, metric: ModelTokenMetric): number {
  if (metric === "input") {
    return summary.inputTokens;
  }

  if (metric === "output") {
    return summary.outputTokens;
  }

  return summary.cacheTokens;
}

function toNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
