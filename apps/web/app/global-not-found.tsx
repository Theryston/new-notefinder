import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

import './globals.css';

import { HtmlDocument } from '@/components/html-document';
import { NotFoundMoment } from '@/components/not-found-moment';
import { Providers } from '@/components/providers';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { currentLocale } from '@/lib/i18n/current-locale';

import { SiteShell } from './site-shell';

/**
 * Framework 404: any URL no route matches, and the proxy's `/_not-found`
 * rewrite for unknown catalog IDs. The proxy forwards the URL's locale, so the
 * page is in that language with the site chrome around it. The blocking
 * render (`instant = false`) keeps the status a real 404 with the full HTML
 * sent before any bytes go out.
 *
 * A URL with no locale header (an API path the proxy skips) falls back to
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

// biome-ignore lint/style/noDefaultExport: Next requires a default export for global-not-found.
export default async function GlobalNotFound() {
  const locale = await currentLocale();
  const { errors } = await getMessages();

  return (
    <HtmlDocument locale={locale}>
      <NextIntlClientProvider messages={{ errors }}>
        <Providers>
          <AuthGate />
          <SiteShell>
            <NotFoundMoment locale={locale} />
          </SiteShell>
        </Providers>
      </NextIntlClientProvider>
    </HtmlDocument>
  );
}
