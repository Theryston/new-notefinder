import { useTranslations } from 'next-intl';

/**
 * Same-dimension placeholders for the track table while it loads, so the
 * page does not jump. Five rows match a typical first page height.
 */
export function ArtistTrackTableSkeleton() {
  const t = useTranslations('artists');
  return (
    <div
      role="status"
      aria-label={t('tracks.loading')}
      className="overflow-x-auto rounded-2xl border border-border"
    >
      <div className="flex min-w-[640px] flex-col">
        {['row-0', 'row-1', 'row-2', 'row-3', 'row-4'].map((key) => (
          <div
            key={key}
            className="flex animate-pulse gap-4 border-border border-b px-4 py-3 last:border-0"
          >
            <div className="h-4 w-1/4 rounded bg-muted" />
            <div className="h-4 w-1/5 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-1/5 rounded bg-muted" />
            <div className="h-4 w-1/6 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
