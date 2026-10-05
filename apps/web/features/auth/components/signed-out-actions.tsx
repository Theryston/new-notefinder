'use client';

import { useTranslations } from 'next-intl';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

import { authHref } from '../redirect-to';

/**
 * A visitor's only header action: sign in, coming back to `currentPath`.
 * Sign up is one link away on the sign-in page.
 */
export function SignedOutActions({ currentPath }: { currentPath: string }) {
  const t = useTranslations('header');

  return (
    <Link
      href={authHref('/sign-in', currentPath)}
      // The bar pads 6px, enough for a 40px avatar; this 32px button leaves
      // 10px above and below, so it gets 4px more to sit concentric.
      className={cn(buttonVariants({ size: 'sm' }), 'mr-1')}
    >
      {t('account.signIn')}
    </Link>
  );
}
