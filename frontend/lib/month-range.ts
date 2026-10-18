/** Default report and settlement window: the 1st of this month to today, in IST (servers run in UTC). */
export function thisMonthRange(now = new Date()): { from: string; to: string } {
  const today = new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  return { from: `${today.slice(0, 8)}01`, to: today };
}
