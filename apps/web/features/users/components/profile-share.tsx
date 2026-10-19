import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { profileShareUrl } from '@/features/users/profile-share';
import { getSiteUrl } from '@/lib/env/client';

import { ProfileShareButton } from './profile-share-button';

/**
 * The banner's Share button, for visitors and the owner alike. The server
 * builds the canonical link; the dialog's client messages come from the
 * `share` namespace only.
 */
export async function ProfileShare({
  name,
  username,
}: {
  name: string;
  username: string;
}) {
  const [locale, { share }] = await Promise.all([getLocale(), getMessages()]);
  const url = profileShareUrl(getSiteUrl(), locale, username);

  return (
    <NextIntlClientProvider messages={{ share }}>
      <ProfileShareButton name={name} url={url} />
    </NextIntlClientProvider>
  );
}
