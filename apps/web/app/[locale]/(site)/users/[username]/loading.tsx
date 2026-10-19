import { ProfileBannerSkeleton } from '@/features/users/components/profile-banner-skeleton';

/** Same-dimension banner skeleton while the Profile loads. */
export default async function UserProfileLoading() {
  return (
    <div className="flex flex-col gap-8">
      <ProfileBannerSkeleton />
    </div>
  );
}
