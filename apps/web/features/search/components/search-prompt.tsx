'use client';

import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Before a searchable query: what to type and where it looks. */
export function SearchPrompt() {
  const t = useTranslations('search.prompt');

  return (
    <div className="mx-auto flex max-w-prose flex-col items-center gap-3 py-16 text-center">
      <SearchIcon
        aria-hidden="true"
        className="size-10 text-muted-foreground"
      />
      <h2 className="font-bold text-2xl tracking-tight">{t('title')}</h2>
      <p className="text-muted-foreground">{t('description')}</p>
    </div>
  );
}
