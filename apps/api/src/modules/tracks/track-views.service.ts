import { Injectable } from '@nestjs/common';
import type { Locale } from '@notefinder/contracts';
import { TrackTrendingQueueService } from './track-trending-queue.service.js';
import { TrackViewRepository } from './track-view.repository.js';
import { TracksService } from './tracks.service.js';

/** What recording a view did: the view's ID, and whether it is a new one. */
export type RecordedView = { viewId: string; created: boolean };

/**
 * Track views, one per browser session. The browser keeps the ID of its
 * view; posting it again after signing in attaches the User to that view.
 */
@Injectable()
export class TrackViewsService {
  constructor(
    private readonly tracks: TracksService,
    private readonly views: TrackViewRepository,
    private readonly trending: TrackTrendingQueueService,
  ) {}

  /**
   * Without `viewId` it records a view (of the User, when signed in) and
   * schedules the trending score. With the ID of a view of this Track it
   * records nothing: it attaches the User when the view has none, and keeps
   * the view's locale. An ID that names no view of this Track (a stale or
   * foreign one) is treated as no ID, so the browser always ends up with a
   * valid view.
   */
  async record(options: {
    trackId: string;
    userId: string | undefined;
    viewId: string | undefined;
    locale?: Locale;
  }): Promise<RecordedView> {
    const { trackId, userId, viewId, locale } = options;
    await this.tracks.assertTrackExists(trackId);
    const existing =
      viewId === undefined
        ? undefined
        : await this.views.findView(viewId, trackId);
    if (existing !== undefined) {
      if (userId !== undefined && existing.userId === null) {
        await this.views.attachUser(existing.id, userId);
      }
      return { viewId: existing.id, created: false };
    }
    const created = await this.views.create(trackId, userId ?? null, locale);
    await this.trending.schedule(trackId);
    return { viewId: created, created: true };
  }
}
