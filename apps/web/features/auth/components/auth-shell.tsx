import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { LogoMark } from '@/components/logo-mark';
import { Link } from '@/lib/i18n/navigation';

import { type AuthStep, FeaturedPanel } from './featured-panel';

/**
 * Page frame shared by the auth steps: the form column (logo on top, a home
 * link only on sign-up; form centered) and, from `lg`, the step's featured panel. Adds the message
 * namespaces the client forms need, only on these pages.
 */
export async function AuthShell({
  step,
  children,
}: {
  step: AuthStep;
  children: ReactNode;
}) {
  const t = await getTranslations('auth');
  const { errors, auth, authErrors } = await getMessages();
  const brand = (
    <>
      <LogoMark className="size-7" />
      <span className="font-bold text-2xl tracking-tight">{t('wordmark')}</span>
    </>
  );

  return (
    <NextIntlClientProvider messages={{ errors, auth, authErrors }}>
      <div className="min-h-svh bg-background lg:grid lg:grid-cols-2">
        <div className="flex min-h-svh flex-col px-4 md:px-6 lg:px-10">
          <header className="flex h-16 shrink-0 items-center md:h-20">
            {step === 'signUp' ? (
              <Link
                href="/"
                aria-label={t('home')}
                className="-mx-2 flex items-center gap-1.5 rounded-full px-2 py-1 outline-none transition-opacity duration-150 ease-out hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {brand}
              </Link>
            ) : (
              // Mid-onboarding there's no way out through the logo: the user
              // finishes the step or signs out.
              <div className="-mx-2 flex items-center gap-1.5 px-2 py-1">
                {brand}
              </div>
            )}
          </header>
          <main className="flex flex-1 items-center justify-center pt-4 pb-16 md:pb-20">
            <div className="fade-in slide-in-from-bottom-1 w-full max-w-sm animate-in duration-200 ease-out-soft">
              {children}
            </div>
          </main>
        </div>
        <FeaturedPanel step={step} />
      </div>
    </NextIntlClientProvider>
  );
}
