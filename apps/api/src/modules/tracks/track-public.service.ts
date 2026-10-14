import { Injectable } from '@nestjs/common';
import type {
  TrackDetail,
  TrackNotes,
  TrackSitemap,
  TrackView,
} from '@notefinder/contracts';
import { TrackPracticeService } from './track-practice.service.js';
import { TrackViewsService } from './track-views.service.js';

/** Public reads and engagement writes exposed by the Tracks controller. */
@Injectable()
export class TrackPublicService {
  constructor(
    private readonly practice: TrackPracticeService,
    private readonly views: TrackViewsService,
  ) {}

  getHeader(trackId: string): Promise<TrackDetail> {
    return this.practice.getHeader(trackId);
  }

  getNotes(trackId: string): Promise<TrackNotes> {
    return this.practice.getNotes(trackId);
  }

  recordView(
    trackId: string,
    viewId: string | undefined,
    userId: string | undefined,
  ): Promise<TrackView> {
    return this.views.record(trackId, viewId, userId);
  }

  sitemap(): Promise<TrackSitemap> {
    return this.views.sitemap();
  }
}
