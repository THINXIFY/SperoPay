import { groupByDayBucket } from '../activityGrouping';

const NOW = new Date('2026-09-10T15:00:00.000Z');

describe('groupByDayBucket', () => {
  it('buckets items into Today, Yesterday, and Earlier', () => {
    const items = [
      { id: 'a', at: '2026-09-10T09:00:00.000Z' }, // today
      { id: 'b', at: '2026-09-09T09:00:00.000Z' }, // yesterday
      { id: 'c', at: '2026-09-01T09:00:00.000Z' }, // earlier
    ];

    const groups = groupByDayBucket(items, (i) => i.at, NOW);

    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Earlier']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['b']);
    expect(groups[2].items.map((i) => i.id)).toEqual(['c']);
  });

  it('omits an empty bucket entirely rather than returning it with zero items', () => {
    const items = [{ id: 'a', at: '2026-09-01T09:00:00.000Z' }];
    const groups = groupByDayBucket(items, (i) => i.at, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Earlier');
  });

  it('returns no groups at all for an empty input', () => {
    expect(groupByDayBucket([], (i: { at: string }) => i.at, NOW)).toEqual([]);
  });

  it('keeps the fixed Today/Yesterday/Earlier order regardless of input order', () => {
    const items = [
      { id: 'earlier', at: '2026-08-01T09:00:00.000Z' },
      { id: 'today', at: '2026-09-10T09:00:00.000Z' },
      { id: 'yesterday', at: '2026-09-09T09:00:00.000Z' },
    ];
    const groups = groupByDayBucket(items, (i) => i.at, NOW);
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Earlier']);
  });

  it('groups multiple items on the same calendar day together', () => {
    // Both safely mid-day UTC so this holds regardless of the test runner's
    // local timezone -- a value near midnight UTC would land on a different
    // local calendar day in some zones, which is a property of "today means
    // the merchant's own local today" (the whole point of using local day
    // boundaries here), not a bug in the function.
    const items = [
      { id: 'a', at: '2026-09-10T08:00:00.000Z' },
      { id: 'b', at: '2026-09-10T14:00:00.000Z' },
    ];
    const groups = groupByDayBucket(items, (i) => i.at, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });
});
