import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import type { FollowCounts } from '../follow-state';
import { ProfileFollowControls } from './profile-follow-controls';

/**
 * The follow counts and button under the Profile banner. Its strings come
 * from the `publicProfile.follow` block and `errors` (for a failed follow),
 * the only namespaces this client tree receives.
 */
export async function ProfileFollow({
  username,
  counts,
}: {
  username: string;
  counts: FollowCounts;
}) {
  const { publicProfile, errors } = await getMessages();
  return (
    <NextIntlClientProvider
      messages={{
        publicProfile: {
          follow: publicProfile.follow,
          followList: publicProfile.followList,
        },
        errors,
      }}
    >
      <ProfileFollowControls username={username} counts={counts} />
    </NextIntlClientProvider>
  );
}
