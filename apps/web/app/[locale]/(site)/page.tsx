import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getLocale } from 'next-intl/server';

import { LogoMark } from '@/components/logo-mark';
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
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-12 md:px-6">
      <LogoMark className="size-12" />
      <h1 className="font-extrabold text-4xl tracking-tight">{t('title')}</h1>
      <p className="text-muted-foreground">{t('description')}</p>
      {placeholderKeys.map((key) => (
        <p key={key} className="max-w-prose">
          {t('placeholder')}
        </p>
      ))}
    </div>
  );
}
