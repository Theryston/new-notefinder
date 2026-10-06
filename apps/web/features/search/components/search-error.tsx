'use client';

import { TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { SearchState } from './search-state';

/** When search or the catalog is down: explain and let the visitor retry. */
export function SearchError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('search.error');

  return (
    <SearchState
      icon={
        <TriangleAlertIcon
          aria-hidden="true"
          className="size-10 text-muted-foreground"
        />
      }
      title={t('title')}
      description={t('description')}
    >
      <Button type="button" onClick={onRetry} className="mt-1">
        {t('retry')}
      </Button>
    </SearchState>
  );
}
