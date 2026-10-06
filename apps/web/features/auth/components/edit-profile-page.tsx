import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

import { EditProfile } from './edit-profile';

/**
 * Frame of `/me/edit`: the heading is part of the static page, the form
 * below it loads with the session. Adds the message namespaces the form
 * needs, only on this page.
 */
export async function EditProfilePage() {
  const t = await getTranslations('profile.edit');
  const { errors, auth, profile } = await getMessages();

  return (
    <div className="flex flex-col gap-8 py-10 md:py-12">
      <header className="flex flex-col gap-3">
        <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          {t('overline')}
        </p>
        <h1 className="font-extrabold text-3xl tracking-tight sm:text-4xl">
          {t('title')}
        </h1>
        <p className="max-w-prose text-muted-foreground">{t('description')}</p>
      </header>
      <NextIntlClientProvider
        messages={{ errors, auth: { fields: auth.fields }, profile }}
      >
        <EditProfile />
      </NextIntlClientProvider>
    </div>
  );
}
