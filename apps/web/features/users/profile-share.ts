import { localizedPath } from '@/lib/i18n/metadata';

/**
 * The canonical, locale-prefixed link of a Profile, on the site's public
 * origin. Shared links never depend on the host the visitor happens to use.
 */
export function profileShareUrl(
  siteUrl: URL,
  locale: string,
  username: string,
): string {
  const path = localizedPath(locale, `/users/${encodeURIComponent(username)}`);
  return new URL(path, siteUrl).toString();
}
