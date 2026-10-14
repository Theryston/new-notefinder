import { Injectable } from '@nestjs/common';
import type { TrackSitemap, TrackView } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { TrackProcessingService } from './track-processing.service.js';
import { TrackTrendingQueueService } from './track-trending-queue.service.js';
import { TrackViewRepository } from './track-view.repository.js';

@Injectable()
export class TrackViewsService {
  constructor(
    private readonly views: TrackViewRepository,
    private readonly trending: TrackTrendingQueueService,
    private readonly processing: TrackProcessingService,
  ) {}

  async record(
    trackId: string,
    viewId: string | undefined,
    userId: string | undefined,
  ): Promise<TrackView> {
    if (viewId !== undefined) {
      const attached = await this.views.attach(trackId, viewId, userId);
      if (!attached) {
        throw new AppException('NOT_FOUND', 'Track view not found');
      }
      return { viewId };
    }

    await this.processing.assertTrackExists(trackId);
    const createdViewId = await this.views.create(trackId, userId ?? null);
    await this.trending.schedule(trackId);
    return { viewId: createdViewId };
  }

  async sitemap(): Promise<TrackSitemap> {
    return { trackIds: await this.views.findSitemapTrackIds() };
  }
}
