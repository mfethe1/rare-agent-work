import { getLatestPublishedAt, getNewsFreshnessSnapshot } from '@/lib/news-helpers';

describe('news freshness helpers', () => {
  it('uses the newest timestamp instead of score-sorted first item', () => {
    const latest = getLatestPublishedAt([
      '2026-03-09T12:00:00.000Z',
      '2026-03-11T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
    ]);

    expect(latest).toBe('2026-03-11T12:00:00.000Z');
  });

  it('marks the feed stale when the newest story is older than the allowed window', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const snapshot = getNewsFreshnessSnapshot(
      [new Date(now - 8 * 3600000).toISOString(), new Date(now - 30 * 3600000).toISOString()],
      6,
    );

    expect(snapshot.stale).toBe(true);
    expect(snapshot.totalItems).toBe(2);
    expect(snapshot.hotItems).toBe(1);

    vi.restoreAllMocks();
  });

  it('marks the feed healthy when a recent story exists even if older stories rank higher elsewhere', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const snapshot = getNewsFreshnessSnapshot(
      [new Date(now - 2 * 3600000).toISOString(), new Date(now - 48 * 3600000).toISOString()],
      6,
    );

    expect(snapshot.stale).toBe(false);
    expect(snapshot.hotItems).toBe(1);
    expect(snapshot.latestPublishedAt).toBe(new Date(now - 2 * 3600000).toISOString());

    vi.restoreAllMocks();
  });
});
