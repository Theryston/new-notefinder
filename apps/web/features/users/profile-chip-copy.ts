import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/lib/i18n/routing';

import type { ProfileChipMessages } from './profile-chips';

/**
 * The translated copy of the Profile chips: the banner's list label and the
 * chips' messages. Read for the request locale, or for an explicit one where
 * there is no request (the preview image is drawn outside the page).
 */
export async function profileChipCopy(locale?: Locale): Promise<{
  highlightsLabel: string;
  messages: ProfileChipMessages;
}> {
  const [t, targetT] = await Promise.all([
    chipsTranslator(locale),
    dailyTargetTranslator(locale),
  ]);
  return {
    highlightsLabel: t('label'),
    messages: {
      label: (key) => t(key),
      dailyTargetValue: (minutes) => targetT('minutes', { minutes }),
      vocalRangeValue: (lowest, highest) =>
        t('vocalRangeValue', { lowest, highest }),
    },
  };
}

function chipsTranslator(locale: Locale | undefined) {
  return locale === undefined
    ? getTranslations('publicProfile.chips')
    : getTranslations({ locale, namespace: 'publicProfile.chips' });
}

// The same minutes wording the Daily target picker shows.
function dailyTargetTranslator(locale: Locale | undefined) {
  return locale === undefined
    ? getTranslations('profile.edit.dailyTarget')
    : getTranslations({ locale, namespace: 'profile.edit.dailyTarget' });
}
