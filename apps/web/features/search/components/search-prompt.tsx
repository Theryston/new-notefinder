'use client';

import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SearchState } from './search-state';

/** Before a searchable query: what to type and where it looks. */
export function SearchPrompt() {
  const t = useTranslations('search.prompt');

  return (
    <SearchState
      icon={
        <SearchIcon
          aria-hidden="true"
          className="size-10 text-muted-foreground"
        />
      }
      title={t('title')}
      description={t('description')}
    />
  );
}
