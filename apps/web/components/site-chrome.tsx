import type { ReactNode } from 'react';

import { Container } from '@/components/container';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

/**
 * The header, the `<main>` column and the footer every site page shares. The
 * header's session-dependent parts come in as slots: this component stays
 * free of feature code.
 */
export function SiteChrome({
  search,
  account,
  children,
}: {
  search: ReactNode;
  account: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader search={search} account={account} />
      <main
        id="main"
        tabIndex={-1}
        className="min-h-[calc(100vh-12rem)] pt-4 outline-none md:pt-6"
      >
        <Container className="flex flex-col gap-2 md:gap-3">
          {children}
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
