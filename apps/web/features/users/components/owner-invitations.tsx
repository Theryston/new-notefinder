'use client';

import { useTranslations } from 'next-intl';

import { buttonVariants } from '@/components/ui/button';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import type { InvitedSection } from '@/features/users/owner-invitations';
import { Link } from '@/lib/i18n/navigation';

/**
 * The invitations to fill the empty sections, for the owner only. Visitors
 * get nothing: an empty section is absent to them, never an invitation.
 */
export function OwnerInvitations({
  username,
  sections,
}: {
  username: string;
  sections: InvitedSection[];
}) {
  return (
    <SessionUserBoundary
      render={(user) =>
        user?.username === username ? (
          <InvitationList sections={sections} />
        ) : null
      }
    />
  );
}

function InvitationList({ sections }: { sections: InvitedSection[] }) {
  const t = useTranslations('profileOwner.invitations');
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section
          key={section}
          aria-labelledby={`owner-invitation-${section}`}
          className="flex flex-col items-start gap-4 rounded-2xl border border-border border-dashed p-6"
        >
          <h2 id={`owner-invitation-${section}`} className="font-bold text-xl">
            {t(`${section}.title`)}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t(`${section}.description`)}
          </p>
          <Link href="/search" className={buttonVariants({ size: 'lg' })}>
            {t(`${section}.cta`)}
          </Link>
        </section>
      ))}
    </div>
  );
}
