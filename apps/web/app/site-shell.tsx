import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Suspense } from 'react';

import { SiteChrome } from '@/components/site-chrome';
import { AccountMenu } from '@/features/auth/components/account-menu';
import { HeaderSearch } from '@/features/search/components/header-search';
import { HeaderSearchFallback } from '@/features/search/components/header-search-bar';

/**
 * The site's header, `<main>` and footer with the session-dependent slots
 * filled in. Both the `(site)` layout and the framework 404 render it, so a new
 * header slot is one edit. It lives under `app/` because it composes features,
 * which `components/` may not import.
 */
export async function SiteShell({ children }: { children: ReactNode }) {
  const { errors, header } = await getMessages();

  return (
    // The header's client components need its messages; only site pages
    // pay for them.
    <NextIntlClientProvider messages={{ errors, header }}>
      <SiteChrome
        search={
          <Suspense fallback={<HeaderSearchFallback />}>
            <HeaderSearch />
          </Suspense>
        }
        account={<AccountMenu />}
      >
        {children}
      </SiteChrome>
    </NextIntlClientProvider>
  );
}
