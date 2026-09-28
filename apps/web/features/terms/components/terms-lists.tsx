import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { termsRichText } from './terms-rich-text';

function TermsList({ children }: { children: ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-muted-foreground">
      {children}
    </ul>
  );
}

export function CopyrightItems() {
  const t = useTranslations('terms.sections.copyright.items');

  return (
    <TermsList>
      <li>{t.rich('directPlayback', termsRichText)}</li>
      <li>{t.rich('otherCases', termsRichText)}</li>
      <li>{t('noModification')}</li>
      <li>{t('noStorage')}</li>
      <li>{t('analysisTool')}</li>
    </TermsList>
  );
}

export function AcceptableUseItems() {
  const t = useTranslations('terms.sections.acceptableUse.items');

  return (
    <TermsList>
      <li>{t('lawfulUse')}</li>
      <li>{t('noIntrusion')}</li>
      <li>{t('noOverload')}</li>
      <li>{t('noDataCollection')}</li>
      <li>{t('respectRights')}</li>
      <li>{t('noCommercialWorks')}</li>
    </TermsList>
  );
}
