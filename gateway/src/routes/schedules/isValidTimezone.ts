// IANA timezone check via Intl. Anything ICU doesn't recognise (e.g. "AEST",
// "GMT+10") throws — we catch and reject. Matches the harness which resolves
// timezones through pytz/zoneinfo.
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
