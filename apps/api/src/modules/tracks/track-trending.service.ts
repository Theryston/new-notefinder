import { Injectable } from '@nestjs/common';
import { cacheTags } from '@notefinder/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { TrackViewRepository } from './track-view.repository.js';
import { TracksRepository } from './tracks.repository.js';
import { type PlatformViewAverages, trendingScore } from './trending-score.js';
import { type ViewWindowStarts, viewWindowStarts } from './view-windows.js';

/** Recomputes the trending score of Tracks from their views. */
@Injectable()
export class TrackTrendingService {
  constructor(
    private readonly views: TrackViewRepository,
    private readonly tracks: TracksRepository,
    private readonly revalidation: WebRevalidationService,
  ) {}

  /**
   * Recomputes one Track, after its views changed. Idempotent: it reads the
   * views as they are now. The Track page shows the view count, so its tag is
   * revalidated; the sitemap is left to the daily run, since a refresh happens
   * every few minutes under steady traffic.
   */
  async refresh(trackId: string, now = new Date()): Promise<void> {
    const starts = viewWindowStarts(now);
    await this.score(
      trackId,
      starts,
      await this.views.platformAverages(starts),
    );
    await this.revalidation.revalidate([cacheTags.track(trackId)]);
  }

  /**
   * Recomputes every scored Track, because the windows roll with time: a Track
   * whose views stopped would otherwise keep its score for ever. The platform
   * averages are read once. Revalidates the sitemap, whose order changed.
   */
  async refreshScored(now = new Date()): Promise<number> {
    const starts = viewWindowStarts(now);
    const platform = await this.views.platformAverages(starts);
    const trackIds = (await this.tracks.findScoredTracks()).map((t) => t.id);
    for (const trackId of trackIds) {
      await this.score(trackId, starts, platform);
    }
    if (trackIds.length > 0) {
      await this.revalidation.revalidate([cacheTags.sitemap]);
    }
    return trackIds.length;
  }

  private async score(
    trackId: string,
    starts: ViewWindowStarts,
    platform: PlatformViewAverages,
  ): Promise<void> {
    const counts = await this.views.countTrackViews(trackId, starts);
    await this.tracks.setTrendingScore(
      trackId,
      trendingScore(counts, platform),
    );
  }
}
