import type { PublicProfile } from '@notefinder/contracts';
import { getFormatter, getTranslations } from 'next-intl/server';

import {
  entityBannerClass,
  entityBannerRowClass,
  entityInfoClass,
  entityTitleClass,
  entityVisualClass,
} from '@/components/entity-header';
import { UserAvatar } from '@/features/auth/components/user-avatar';
import { ProfileChips } from '@/features/users/components/profile-chips';

/**
 * The Profile banner, a featured block (DESIGN.md "Featured blocks"): the
 * Avatar, or the initials on the orange surface, sits on the right; the Name
 * in display type with the `@username` and "member since" lines on the left.
 */
export async function ProfileBanner({ profile }: { profile: PublicProfile }) {
  const [t, format] = await Promise.all([
    getTranslations('publicProfile'),
    getFormatter(),
  ]);
  const memberSince = format.dateTime(new Date(profile.createdAt), {
    year: 'numeric',
    month: 'long',
  });

  return (
    <section aria-labelledby="profile-name" className={entityBannerClass}>
      <div className={entityBannerRowClass}>
        <UserAvatar
          user={{
            name: profile.name,
            username: profile.username,
            image: profile.image ?? undefined,
          }}
          className={`${entityVisualClass} *:data-[slot=avatar-fallback]:bg-primary-foreground *:data-[slot=avatar-fallback]:text-2xl *:data-[slot=avatar-fallback]:text-primary md:*:data-[slot=avatar-fallback]:text-3xl`}
        />
        <div className="flex min-w-0 flex-col gap-3 sm:flex-1">
          <h1 id="profile-name" className={entityTitleClass}>
            {profile.name}
          </h1>
          <p className={entityInfoClass}>@{profile.username}</p>
          <p className={entityInfoClass}>
            {t('banner.memberSince', { date: memberSince })}
          </p>
          <ProfileChips profile={profile} />
        </div>
      </div>
    </section>
  );
}
