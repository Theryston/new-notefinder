import { cookies, headers } from 'next/headers';

import { Container } from '@/components/container';
import { NotFoundView } from '@/components/not-found-view';
import { detectLocale } from '@/lib/i18n/detect-locale';
import { localeCookieName } from '@/lib/i18n/routing';
import en from '@/messages/en.json';
import ptBR from '@/messages/pt-BR.json';

// Reads the request (cookies/headers) to detect the visitor's locale, so this
// route never prerenders: the proxy serves it for unknown catalog IDs.
export const instant = false;

/**
 * Root 404: served for unknown paths (rendered inside `[locale]/layout.tsx`,
 * which already provides `<html>`/`<body>`, so this file returns neither) and
 * for `/_not-found` (the proxy rewrites unknown catalog IDs there). It has no
 * locale segment, so the locale is detected like `proxy.ts` does and the
 * catalog is read directly instead of through `getTranslations` (which needs
 * the `[locale]` request config).
 */
export default async function RootNotFound() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = detectLocale({
    cookie: cookieStore.get(localeCookieName)?.value,
    country: headerStore.get('cf-ipcountry'),
    acceptLanguage: headerStore.get('accept-language'),
  });
  const messages = locale === 'pt-BR' ? ptBR.notFound : en.notFound;

  return (
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
  );
}
