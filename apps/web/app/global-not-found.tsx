import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';

import './globals.css';

import { Suspense } from 'react';
import { HtmlDocument } from '@/components/html-document';
import { NotFoundMoment } from '@/components/not-found-moment';
import { Providers } from '@/components/providers';
import { SiteChrome } from '@/components/site-chrome';
import { AccountMenu } from '@/features/auth/components/account-menu';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { HeaderSearch } from '@/features/search/components/header-search';
import { HeaderSearchFallback } from '@/features/search/components/header-search-bar';

/**
 * Framework 404: any URL no route matches, and the proxy's `/_not-found`
 * rewrite for unknown catalog IDs. The proxy forwards the URL's locale, so the
 * page is in that language with the site chrome around it. The blocking
 * render (`instant = false`) keeps the status a real 404 with the full HTML
 * sent before any bytes go out.
 *
 * A URL with no locale at all (an API path the proxy skips) falls back to
 * English: the `en` catalog answers, not hard-coded strings.
 */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notFound');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: { index: false },
  };
}

// `biome.json` allows default exports only in the `not-found.tsx` and
// `global-error.tsx` framework files; Next requires this file's default export.
// biome-ignore lint/style/noDefaultExport: Next's global-not-found convention needs a default export
export default async function GlobalNotFound() {
  const locale = await getLocale();
  const { errors, header } = await getMessages();

  return (
    <HtmlDocument locale={locale}>
      <NextIntlClientProvider messages={{ errors, header }}>
        <Providers>
          <AuthGate />
          <SiteChrome
            search={
              <Suspense fallback={<HeaderSearchFallback />}>
                <HeaderSearch />
              </Suspense>
            }
            account={<AccountMenu />}
          >
            <NotFoundMoment locale={locale} />
          </SiteChrome>
        </Providers>
      </NextIntlClientProvider>
    </HtmlDocument>
  );
}
