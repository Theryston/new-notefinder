import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

import { AdminIndex } from './admin-index';

/**
 * Frame of `/admin`: the heading is part of the static page, the cards load
 * with the session. Adds only the message namespace the page needs.
 */
export async function AdminIndexPage() {
  const t = await getTranslations('admin');
  const { admin } = await getMessages();

  return (
    <div className="flex flex-col gap-2 py-10 md:py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-extrabold text-3xl tracking-tight sm:text-4xl">
          {t('title')}
        </h1>
        <p className="max-w-prose text-muted-foreground">{t('description')}</p>
      </header>
      <NextIntlClientProvider messages={{ admin }}>
        <AdminIndex />
      </NextIntlClientProvider>
    </div>
  );
}
