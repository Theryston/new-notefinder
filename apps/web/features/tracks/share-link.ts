/**
 * The link to share: the Track page without its query string or fragment,
 * plus `?time=` (whole seconds) when a moment past the start is given, which
 * the page reads back to start there. Nothing played yet (0) is the page
 * itself, as the legacy app shared it.
 */
export function shareLink(pageUrl: string, seconds: number | null): string {
  const url = new URL(pageUrl);
  url.search = '';
  url.hash = '';
  const whole = seconds === null ? 0 : Math.floor(seconds);
  if (whole > 0) url.searchParams.set('time', String(whole));
  return url.toString();
}
