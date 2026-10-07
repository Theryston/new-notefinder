'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

/** Empty track grid: the artist has no processed tracks yet. */
export function ArtistTracksEmpty() {
  const t = useTranslations('artists');
  return (
    <div className="rounded-2xl border border-border px-4 py-8 text-center">
      <p className="font-semibold">{t('tracks.empty.title')}</p>
      <p className="mt-1 text-muted-foreground text-sm">
        {t('tracks.empty.description')}
      </p>
    </div>
  );
}

/** Track grid error with a retry, for network or API failures. */
export function ArtistTracksError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('artists');
  return (
    <div className="rounded-2xl border border-border px-4 py-8 text-center">
      <p className="font-semibold">{t('tracks.error.title')}</p>
      <p className="mt-1 text-muted-foreground text-sm">
        {t('tracks.error.description')}
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={onRetry}
        className="mt-4"
      >
        {t('tracks.error.retry')}
      </Button>
    </div>
  );
}
