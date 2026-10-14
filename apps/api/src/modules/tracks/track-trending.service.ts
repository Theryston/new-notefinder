import { Injectable } from '@nestjs/common';
import { cacheTags } from '@notefinder/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { TrackViewRepository } from './track-view.repository.js';
import { trendingScore } from './trending-score.js';
import { viewWindowStarts } from './view-windows.js';

/** Recomputes the trending score of a Track from its views. */
@Injectable()
export class TrackTrendingService {
  constructor(
    private readonly views: TrackViewRepository,
    private readonly revalidation: WebRevalidationService,
  ) {}

  /**
   * Idempotent: it reads the views as they are now. The Track page shows the
   * view count and the sitemap the order, so both are revalidated.
   */
  async refresh(trackId: string, now = new Date()): Promise<void> {
    const starts = viewWindowStarts(now);
    const [counts, platform] = await Promise.all([
      this.views.countTrackViews(trackId, starts),
      this.views.platformAverages(starts),
    ]);
    await this.views.setTrendingScore(trackId, trendingScore(counts, platform));
    await this.revalidation.revalidate([
      cacheTags.track(trackId),
      cacheTags.sitemap,
    ]);
  }
}
