import type { RawUsageReport } from "./types";

export type UsageFetcher = (toolId: string, since: string) => Promise<RawUsageReport>;

export interface UsageCache {
  load(toolId: string, since: string, options?: { refresh?: boolean }): Promise<RawUsageReport>;
  clear(): void;
}

export function createUsageCache(fetcher: UsageFetcher): UsageCache {
  const cache = new Map<string, Promise<RawUsageReport>>();

  return {
    load(toolId, since, options = {}) {
      const key = `${toolId}:${since}`;

      if (!options.refresh && cache.has(key)) {
        return cache.get(key)!;
      }

      const request = fetcher(toolId, since).catch((error) => {
        cache.delete(key);
        throw error;
      });
      cache.set(key, request);
      return request;
    },
    clear() {
      cache.clear();
    },
  };
}
