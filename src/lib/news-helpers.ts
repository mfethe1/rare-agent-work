const HOUR_MS = 3600000;

export interface NewsFreshnessSnapshot {
  totalItems: number;
  hotItems: number;
  latestPublishedAt?: string;
  maxAgeHours?: number;
  stale: boolean;
}

export function formatNewsAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / HOUR_MS);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function isBreakingNews(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() < 12 * HOUR_MS;
}

export function getHotNewsCount(publishedAt: string[]): number {
  return publishedAt.filter((value) => Date.now() - new Date(value).getTime() <= 24 * HOUR_MS).length;
}

export function getLatestPublishedAt(publishedAt: string[]): string | undefined {
  const valid = publishedAt
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (valid.length === 0) return undefined;
  return new Date(Math.max(...valid)).toISOString();
}

export function getNewsFreshnessSnapshot(
  publishedAt: string[],
  maxAgeHours = 6,
): NewsFreshnessSnapshot {
  const latestPublishedAt = getLatestPublishedAt(publishedAt);
  const hotItems = getHotNewsCount(publishedAt);
  const totalItems = publishedAt.length;

  if (!latestPublishedAt) {
    return {
      totalItems,
      hotItems,
      latestPublishedAt: undefined,
      maxAgeHours,
      stale: true,
    };
  }

  const ageHours = (Date.now() - new Date(latestPublishedAt).getTime()) / HOUR_MS;

  return {
    totalItems,
    hotItems,
    latestPublishedAt,
    maxAgeHours,
    stale: ageHours > maxAgeHours,
  };
}
