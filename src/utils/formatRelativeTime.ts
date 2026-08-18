export function formatRelativeTime(isoDate: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(isoDate).getTime();

  // Guard against unparseable input (invalid ISO strings produce NaN here).
  // Note: negative diffs (future dates) also intentionally collapse to
  // 'just now' — only past createdAt timestamps are ever passed in this app,
  // so "in Xd"-style future formatting is out of scope by design, not an oversight.
  if (Number.isNaN(diffMs)) return 'just now';

  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
