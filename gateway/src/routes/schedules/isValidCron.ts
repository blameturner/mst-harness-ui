// Validate a 5-field POSIX cron expression. We deliberately reject both the
// 6-field (seconds) form and the @hourly / @daily aliases because
// CronTrigger.from_crontab in the harness only understands classic 5-field.
// Returning early with a clear error is better than an opaque harness 500.
export function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const fieldPattern = /^(\*|[\d,\-/*]+)$/;
  return parts.every((p) => fieldPattern.test(p));
}
