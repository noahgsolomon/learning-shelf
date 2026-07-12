// Current publish streak from a member's activeDays (UTC YYYY-MM-DD).
// A streak is alive if its latest day is today or yesterday (yesterday
// keeps the flame lit while today's session is still ahead of them).

export function currentStreak(days: string[] | undefined, now = Date.now()): number {
  if (!days || days.length === 0) return 0;
  const set = new Set(days);
  const dayAt = (offset: number) =>
    new Date(now - offset * 86400000).toISOString().slice(0, 10);
  const start = set.has(dayAt(0)) ? 0 : set.has(dayAt(1)) ? 1 : -1;
  if (start < 0) return 0;
  let n = 0;
  while (set.has(dayAt(start + n))) n++;
  return n;
}
