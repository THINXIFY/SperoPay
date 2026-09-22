export interface DayGroup<T> {
  label: 'Today' | 'Yesterday' | 'Earlier';
  items: T[];
}

const FIXED_ORDER: DayGroup<unknown>['label'][] = ['Today', 'Yesterday', 'Earlier'];

// Buckets items by calendar day (in the DEVICE's local time zone, via the
// plain Date constructor -- an activity feed is read by the merchant on
// their own device, so "today" should mean their today, not UTC's).
// Always returns groups in Today -> Yesterday -> Earlier order regardless
// of which bucket's first item was seen first, and never returns an empty
// group (a feed with only old items has no "Today" section at all, not an
// empty one).
export function groupByDayBucket<T>(items: T[], getIso: (item: T) => string, now: Date = new Date()): DayGroup<T>[] {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const yesterday = today - 24 * 60 * 60 * 1000;

  const buckets = new Map<DayGroup<T>['label'], T[]>();
  for (const item of items) {
    const itemDay = startOfDay(new Date(getIso(item)));
    const label: DayGroup<T>['label'] = itemDay === today ? 'Today' : itemDay === yesterday ? 'Yesterday' : 'Earlier';
    const existing = buckets.get(label);
    if (existing) existing.push(item);
    else buckets.set(label, [item]);
  }

  return FIXED_ORDER.filter((label) => buckets.has(label)).map((label) => ({ label, items: buckets.get(label) as T[] }));
}
