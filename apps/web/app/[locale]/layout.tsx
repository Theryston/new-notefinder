import type { Metadata } from 'next';
import { Geist_Mono, Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';

import '../globals.css';
import { Providers } from '@/components/providers';
import { getSiteUrl } from '@/lib/env/client';
import { routing } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const fontMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

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
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        'antialiased',
        fontMono.variable,
        'font-sans',
        inter.variable,
      )}
    >
      <body>
        {/* Only the namespaces client components need, to keep the RSC
            payload small. */}
        <NextIntlClientProvider messages={{ errors }}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
