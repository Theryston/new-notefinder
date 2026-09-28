import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import type en from '@/messages/en.json';

import { AcceptableUseItems, CopyrightItems } from './terms-lists';
import { termsRichText } from './terms-rich-text';

type SectionId = keyof typeof en.terms.sections;

// ISO date of the last change to the terms. Bump it with any edit to them.
const LAST_UPDATED = '2025-10-31';

// In display order; the heading number is the position. `list` is the bullet
// list some sections carry after their intro.
const SECTIONS: { id: SectionId; list?: ReactNode }[] = [
  { id: 'acceptance' },
  { id: 'service' },
  { id: 'copyright', list: <CopyrightItems /> },
  { id: 'acceptableUse', list: <AcceptableUseItems /> },
  { id: 'accounts' },
  { id: 'privacy' },
  { id: 'liability' },
  { id: 'accuracy' },
  { id: 'serviceChanges' },
  { id: 'termsChanges' },
  { id: 'thirdParties' },
  { id: 'governingLaw' },
  { id: 'contact' },
  { id: 'general' },
];

function TermsSection({
  id,
  number,
  children,
}: {
  id: SectionId;
  number: number;
  children?: ReactNode;
}) {
  const t = useTranslations('terms');

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-bold text-2xl tracking-tight">
        {t('sectionHeading', {
          number,
          title: t(`sections.${id}.title`),
        })}
      </h2>
      <p>{t.rich(`sections.${id}.body`, termsRichText)}</p>
      {children}
    </section>
  );
}

export function TermsDocument() {
  const t = useTranslations('terms');
  const format = useFormatter();
  // Pinned to UTC: the date carries no time, and the visitor's or server's
  // zone must not move it to the day before.
  const lastUpdated = format.dateTime(new Date(LAST_UPDATED), {
    dateStyle: 'long',
    timeZone: 'UTC',
  });

  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="font-extrabold text-4xl tracking-tight">{t('title')}</h1>
        <p className="font-medium text-muted-foreground text-sm">
          {t.rich('lastUpdated', {
            date: lastUpdated,
            time: (chunks) => <time dateTime={LAST_UPDATED}>{chunks}</time>,
          })}
        </p>
      </header>
      {SECTIONS.map(({ id, list }, index) => (
        <TermsSection key={id} id={id} number={index + 1}>
          {list}
        </TermsSection>
      ))}
    </article>
  );
}
