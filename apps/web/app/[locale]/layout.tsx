import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';

import '../globals.css';
import { HtmlDocument } from '@/components/html-document';
import { Providers } from '@/components/providers';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { getSiteUrl } from '@/lib/env/client';
import { routing } from '@/lib/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');

  return {
    // Resolves the relative canonical/hreflang URLs pages set with
    // `localeAlternates` into absolute ones, as search engines require.
    metadataBase: getSiteUrl(),
    title: { default: t('title'), template: t('titleTemplate') },
    description: t('description'),
  };
}

export default async function LocaleLayout({
  children,
}: LayoutProps<'/[locale]'>) {
  // Resolved from `next/root-params` in lib/i18n/request.ts, which also
  // rejects unknown locales with notFound().
  const locale = await getLocale();
  const { errors } = await getMessages();

  return (
    <HtmlDocument locale={locale}>
      {/* Only the namespaces client components need, to keep the RSC
          payload small. */}
      <NextIntlClientProvider messages={{ errors }}>
        <Providers>
          <AuthGate />
          {children}
        </Providers>
      </NextIntlClientProvider>
    </HtmlDocument>
  );
}
