const HOUR_MS = 3600000;

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
