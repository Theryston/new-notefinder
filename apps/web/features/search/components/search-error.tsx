'use client';

import { TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

/** When search or the catalog is down: explain and let the visitor retry. */
export function SearchError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('search.error');

  return (
    <div className="mx-auto flex max-w-prose flex-col items-center gap-3 py-16 text-center">
      <TriangleAlertIcon
        aria-hidden="true"
        className="size-10 text-muted-foreground"
      />
      <h2 className="font-bold text-2xl tracking-tight">{t('title')}</h2>
      <p className="text-muted-foreground">{t('description')}</p>
      <Button type="button" onClick={onRetry} className="mt-1">
        {t('retry')}
      </Button>
    </div>
  );
}
