import { useTranslations } from 'next-intl';

import { TERMS_ADVERTISING_FRAGMENT } from '@/lib/terms-fragments';

import { TermsList } from './terms-lists';
import { termsRichText } from './terms-rich-text';

/**
 * The advertising subsection of the third-party terms. Its heading is the
 * target of the "sponsored content" notice on the home page, so the fragment
 * comes from `lib/terms-fragments` and the heading clears the sticky header.
 */
export function AdvertisingItems() {
  const t = useTranslations('terms.advertising');

  return (
    <div className="flex flex-col gap-3">
      <h3
        id={TERMS_ADVERTISING_FRAGMENT}
        className="scroll-mt-28 font-semibold text-lg"
      >
        {t('title')}
      </h3>
      <p>{t('body')}</p>
      <TermsList>
        <li>{t('items.externalAds')}</li>
        <li>{t('items.internalAds')}</li>
        <li>{t.rich('items.sponsorship', termsRichText)}</li>
      </TermsList>
    </div>
  );
}
