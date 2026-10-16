import { getTranslations } from 'next-intl/server';
import { getTrackRecommendations } from '../recommendations-queries';
import { creditText } from '../track-credit';
import { TrackCard } from './track-card';
import { TrackCardGrid } from './track-card-grid';

/** Suggestions are a bonus: an API failure never prevents practice. */
export async function TrackRecommendations({ trackId }: { trackId: string }) {
  const [result, t] = await Promise.all([
    getTrackRecommendations(trackId).catch(() => undefined),
    getTranslations('tracks.practice'),
  ]);
  if (!result || result.tracks.length === 0) return null;
  return (
    <section
      aria-labelledby="track-recommendations-title"
      className="flex flex-col gap-4 pb-[calc(var(--dock-height,0px)+1.5rem)]"
    >
      <h2
        id="track-recommendations-title"
        className="font-bold text-2xl tracking-tight"
      >
        {t('moreToSing')}
      </h2>
      <TrackCardGrid>
        {result.tracks.map((track) => (
          <TrackCard
            key={track.id}
            trackId={track.id}
            title={track.title}
            subtitle={creditText(track.artistCredit)}
            coverArtUrl={track.coverUrl}
            placeholderSeed={track.id}
          />
        ))}
      </TrackCardGrid>
    </section>
  );
}
