'use client';

import { SearchXIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SearchState } from './search-state';

/** Clear end of a search that matched nothing: try another query. */
export function SearchEmpty({ query }: { query: string }) {
  const t = useTranslations('search.empty');

  return (
    <SearchState
      icon={
        <SearchXIcon
          aria-hidden="true"
          className="size-10 text-muted-foreground"
        />
      }
      title={t('title')}
      description={t('description', { query })}
    />
  );
}
