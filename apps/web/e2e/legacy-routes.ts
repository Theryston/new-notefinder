/**
 * Every public route of the legacy web app (the "Legacy routes" table in
 * apps/web/AGENTS.md), with sample IDs, usernames and query params.
 *
 * This table is how "no legacy URL may return 404" is enforced:
 * - every entry must redirect from its unprefixed path to `/<locale>` + the
 *   same path and query;
 * - `implemented: true` also asserts the final page is not a 404. When a
 *   route ships, flip its flag in the same PR (and make sure the sample
 *   path resolves, e.g. by seeding or mocking the record it points to).
 *   A PR that renames a route adds its 308 redirect here as well.
 *
 * Keep it in sync with the table in apps/web/AGENTS.md.
 */
export type LegacyRoute = {
  /** Unprefixed legacy URL, including a sample query string when relevant. */
  path: `/${string}`;
  implemented: boolean;
  /**
   * Set when the route isn't handled yet; its test is registered as
   * `test.fixme` with this reason.
   */
  todo?: string;
};

const sitemapTodo =
  'proxy.ts skips *.xml paths, so legacy sitemap URLs 404 until the new ' +
  'sitemaps exist (keep them or redirect them there)';

export const legacyRoutes: LegacyRoute[] = [
  { path: '/', implemented: true },
  { path: '/search?q=queen', implemented: false },
  { path: '/search?q=bohemian%20rhapsody&page=2', implemented: false },
  { path: '/tracks/clx123abc', implemented: false },
  { path: '/tracks/clx123abc?x=1', implemented: false },
  { path: '/artists/clx456def', implemented: false },
  { path: '/albums/clx789ghi', implemented: false },
  { path: '/users/john.doe', implemented: false },
  { path: '/me/edit', implemented: true },
  { path: '/sign-in?redirectTo=/me/edit', implemented: true },
  { path: '/sign-up?redirectTo=/tracks/clx123abc', implemented: true },
  { path: '/verify-email', implemented: true },
  { path: '/forgot-password', implemented: true },
  {
    path: '/forgot-password/reset?email=john%40example.com',
    implemented: true,
  },
  { path: '/setup-username?redirectTo=/me/edit', implemented: true },
  { path: '/terms', implemented: true },
  { path: '/sitemap.xml', implemented: false, todo: sitemapTodo },
  { path: '/tracks/sitemap/0.xml', implemented: false, todo: sitemapTodo },
  { path: '/artists/sitemap/0.xml', implemented: false, todo: sitemapTodo },
  { path: '/albums/sitemap/0.xml', implemented: false, todo: sitemapTodo },
];
