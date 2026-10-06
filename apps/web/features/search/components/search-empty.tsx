'use client';

import { SearchXIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Clear end of a search that matched nothing: try another query. */
export function SearchEmpty({ query }: { query: string }) {
  const t = useTranslations('search.empty');

  return (
    <div className="mx-auto flex max-w-prose flex-col items-center gap-3 py-16 text-center">
      <SearchXIcon
        aria-hidden="true"
        className="size-10 text-muted-foreground"
      />
      <h2 className="font-bold text-2xl tracking-tight">{t('title')}</h2>
      <p className="text-muted-foreground">{t('description', { query })}</p>
    </div>
  );
}
