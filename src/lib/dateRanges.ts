import type { TimeRangeId, TimeRangeOption } from "./types";

export const timeRangeOptions: TimeRangeOption[] = [
  { id: "today", label: "Today", daysBack: 0 },
  { id: "1d", label: "Last 1 day", daysBack: 1 },
  { id: "3d", label: "Last 3 days", daysBack: 3 },
  { id: "7d", label: "Last 7 days", daysBack: 7 },
  { id: "15d", label: "Last 15 days", daysBack: 15 },
  { id: "30d", label: "Last 30 days", daysBack: 30 },
];

export function getSinceDate(rangeId: TimeRangeId, now = new Date()): string {
  const option = timeRangeOptions.find((item) => item.id === rangeId) ?? timeRangeOptions[0];
  const since = new Date(now);
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - option.daysBack);
  return formatYYYYMMDD(since);
}

export function formatYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}
