import { ProfileBannerSkeleton } from '@/features/users/components/profile-banner-skeleton';

/**
 * Same-dimension banner skeleton while the Profile loads. The layout's footer
 * sits just under the first screen while `main` is only its minimum height, so
 * the sections that stream in below the banner would pull the footer on screen
 * and shift it. The stand-in is at least one screen tall, which keeps the
 * footer below the fold until the Profile arrives.
 */
export default async function UserProfileLoading() {
  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col gap-8">
      <ProfileBannerSkeleton />
    </div>
  );
}
