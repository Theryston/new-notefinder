import {
  EDITORIAL_PIN_AUDIENCES,
  EDITORIAL_PIN_LAYOUTS,
  EDITORIAL_PIN_MAX_POSITION,
  EDITORIAL_PIN_MAX_PRIORITY,
  EDITORIAL_PIN_MAX_TRACKS,
  EDITORIAL_PIN_TITLE_MAX_LENGTH,
  HERO_POSITION,
  LOCALES,
} from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

import type { PinFormCatalog } from '../pin-form';
import { AdminHomePins } from './admin-home-pins';

/** The runtime facts the pin form needs, single-sourced from the contracts. */
const catalog: PinFormCatalog = {
  layouts: [...EDITORIAL_PIN_LAYOUTS],
  audiences: [...EDITORIAL_PIN_AUDIENCES],
  locales: [...LOCALES],
  heroPosition: HERO_POSITION,
  maxTracks: EDITORIAL_PIN_MAX_TRACKS,
  maxPosition: EDITORIAL_PIN_MAX_POSITION,
  maxPriority: EDITORIAL_PIN_MAX_PRIORITY,
  maxTitleLength: EDITORIAL_PIN_TITLE_MAX_LENGTH,
};

/**
 * Frame of `/admin/home-pins`: the heading is part of the static page, the
 * panel below it loads with the session and the pins. Adds only the message
 * namespace the panel needs.
 */
export async function AdminHomePinsPage() {
  const t = await getTranslations('adminHomePins');
  const { adminHomePins, errors } = await getMessages();

  return (
    <div className="flex flex-col gap-2 py-10 md:py-12">
      <header className="flex flex-col gap-3">
        <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          {t('overline')}
        </p>
        <h1 className="font-extrabold text-3xl tracking-tight sm:text-4xl">
          {t('title')}
        </h1>
        <p className="max-w-prose text-muted-foreground">{t('description')}</p>
      </header>
      <NextIntlClientProvider messages={{ adminHomePins, errors }}>
        <AdminHomePins catalog={catalog} />
      </NextIntlClientProvider>
    </div>
  );
}
