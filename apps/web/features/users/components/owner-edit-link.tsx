'use client';

import { PencilIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { buttonVariants } from '@/components/ui/button';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { Link } from '@/lib/i18n/navigation';

/**
 * The owner's Edit profile button. While the session loads it holds the
 * button's footprint, so the banner does not move when it appears; visitors
 * and other Users get nothing after that.
 */
export function OwnerEditLink({ username }: { username: string }) {
  const t = useTranslations('profileOwner');
  return (
    <SessionUserBoundary
      render={(user, loading) => {
        if (loading) {
          return <span aria-hidden="true" className="h-10 w-36" />;
        }
        if (user?.username !== username) {
          return null;
        }
        return (
          <Link
            href="/me/edit"
            className={buttonVariants({ variant: 'outline' })}
          >
            <PencilIcon aria-hidden="true" />
            {t('editProfile')}
          </Link>
        );
      }}
    />
  );
}
