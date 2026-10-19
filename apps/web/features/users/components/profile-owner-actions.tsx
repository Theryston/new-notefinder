import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { OwnerEditLink } from './owner-edit-link';

/**
 * The banner's owner actions, read in the browser from the session so the
 * cached public banner stays static. Its strings come from the `profileOwner`
 * block, the only namespace this client tree receives.
 */
export async function ProfileOwnerActions({ username }: { username: string }) {
  const { profileOwner } = await getMessages();
  return (
    <NextIntlClientProvider messages={{ profileOwner }}>
      <OwnerEditLink username={username} />
    </NextIntlClientProvider>
  );
}
