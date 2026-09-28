import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { LogoMark } from '@/components/logo-mark';
import { Link } from '@/lib/i18n/navigation';

/**
 * Frame for the terms: the brand as a way back home, and a reading column
 * (`max-w-prose`, so lines stay near 65 characters).
 */
export function TermsShell({ children }: { children: ReactNode }) {
  const t = useTranslations('terms');

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto w-full max-w-prose px-4 md:px-6">
        <header className="flex h-16 items-center md:h-20">
          <Link
            href="/"
            aria-label={t('home')}
            className="-mx-2 flex items-center gap-1.5 rounded-full px-2 py-1 outline-none transition-opacity duration-150 ease-out hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LogoMark className="size-7" />
            <span className="font-bold text-2xl tracking-tight">
              {t('wordmark')}
            </span>
          </Link>
        </header>
        <main className="pt-4 pb-16 md:pb-24">{children}</main>
      </div>
    </div>
  );
}
