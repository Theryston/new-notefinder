import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getLocale } from 'next-intl/server';

import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localeAlternates(await getLocale(), '/') };
}

// Temporary filler so the page scrolls while the header is built; replaced
// by the real home sections.
const placeholderKeys = Array.from(
  { length: 12 },
  (_, index) => `placeholder-${index}`,
);

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <>
      <div className="rounded-lg bg-primary p-4">
        <h1 className="font-extrabold text-4xl tracking-tight">{t('title')}</h1>
        <p className="text-primary-foreground">{t('description')}</p>
      </div>
      {placeholderKeys.map((key) => (
        <p key={key}>{t('placeholder')}</p>
      ))}
    </>
  );
}
