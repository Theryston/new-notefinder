// The networks are generic (components/share); the Track share tests still
// import them from this module, so it keeps re-exporting them.
// biome-ignore lint/performance/noBarrelFile: a re-export for the existing Track share tests, not a barrel of this module.
export {
  SHARE_NETWORKS,
  shareHref,
} from '@/components/share/share-networks';

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
