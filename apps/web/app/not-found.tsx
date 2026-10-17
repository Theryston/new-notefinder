import type { Metadata } from 'next';
import { Figtree, Geist_Mono } from 'next/font/google';
import { cookies, headers } from 'next/headers';

import { Container } from '@/components/container';
import { NotFoundTheme } from '@/components/not-found-theme';
import { NotFoundView } from '@/components/not-found-view';
import { detectLocale } from '@/lib/i18n/detect-locale';
import {
  isLocale,
  localeCookieName,
  requestLocaleHeader,
} from '@/lib/i18n/routing';
import en from '@/messages/en.json';
import ptBR from '@/messages/pt-BR.json';

import './globals.css';

// Reads the request (cookies/headers) to detect the visitor's locale, so this
// route never prerenders.
export const instant = false;

// Unmatched URLs never reach `[locale]/layout.tsx` (Next renders the root
// not-found standalone), so this file brings what that layout normally
// provides: the same fonts, their variables scoped to the wrapper below.
// Theme comes from `<NotFoundTheme/>`: the 404 renders no ThemeProvider, so
// nothing else would set the `dark` class the tokens key off.
const fontSans = Figtree({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'optional',
});

const fontMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'optional',
});

async function getNotFoundLocale() {
  const headerStore = await headers();
  // The URL locale wins (like every other page): the proxy stamps it on every
  // locale-prefixed request, so a shared `/pt-BR/…` link always renders
  // Portuguese, even for a visitor whose browser is English. Only requests
  // that never passed the proxy fall back to detection.
  const fromUrl = headerStore.get(requestLocaleHeader);
  if (isLocale(fromUrl)) return fromUrl;
  const cookieStore = await cookies();
  return detectLocale({
    cookie: cookieStore.get(localeCookieName)?.value,
    country: headerStore.get('cf-ipcountry'),
    acceptLanguage: headerStore.get('accept-language'),
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getNotFoundLocale();
  const messages = locale === 'pt-BR' ? ptBR.notFound : en.notFound;

  return {
    title: messages.metaTitle,
    description: messages.description,
  };
}

/**
 * Root 404: served for unmatched URLs and for `/_not-found` (the proxy
 * rewrites unknown catalog IDs there). It has no locale segment, so the
 * locale is detected like `proxy.ts` does and the catalog is read directly
 * instead of through `getTranslations` (which needs the `[locale]` request
 * config).
 */
export default async function RootNotFound() {
  const locale = await getNotFoundLocale();
  const messages = locale === 'pt-BR' ? ptBR.notFound : en.notFound;

  return (
    <div
      className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`}
    >
      <NotFoundTheme />
      <Container>
        <NotFoundView
          title={messages.title}
          description={messages.description}
          homeLabel={messages.home}
          searchLabel={messages.search}
          homeHref={`/${locale}`}
          searchHref={`/${locale}/search`}
        />
      </Container>
    </div>
  );
}
