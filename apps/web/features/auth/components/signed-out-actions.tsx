'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

import { authHref } from '../redirect-to';
import { MenuSkeleton } from './menu-skeleton';

// The menus (Base UI menu and drawer) are the heaviest part of the header:
// they load after the page, not with it.
const GuestMenu = dynamic(
  () => import('./guest-menu').then((module) => module.GuestMenu),
  { ssr: false, loading: MenuSkeleton },
);

/** Sign in and sign up, both coming back to `currentPath`, and the menu. */
export function SignedOutActions({ currentPath }: { currentPath: string }) {
  const t = useTranslations('header');
  const signUp = authHref('/sign-up', currentPath);

  return (
    <div className="flex items-center gap-1">
      <Link
        href={authHref('/sign-in', currentPath)}
        className={buttonVariants({ variant: 'ghost' })}
      >
        {t('account.signIn')}
      </Link>
      <Link
        href={signUp}
        // `cn`, not cva's `className`: only merging drops the base `inline-flex`.
        className={cn(buttonVariants(), 'hidden md:inline-flex')}
      >
        {t('account.signUp')}
      </Link>
      <GuestMenu signUp={signUp} />
    </div>
  );
}
