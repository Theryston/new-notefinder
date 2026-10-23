import { Injectable } from '@nestjs/common';
import type { EditorialPinMetrics } from '@notefinder/contracts';
import { EventsRepository, type PinEventWindow } from './events.repository.js';

export type PinMetricsWindow = PinEventWindow & {
  pinId: string;
};

/** Read-only aggregates over events that have reached the database. */
@Injectable()
export class EventsAnalyticsService {
  constructor(private readonly events: EventsRepository) {}

  async pinMetrics(
    windows: PinMetricsWindow[],
  ): Promise<EditorialPinMetrics[]> {
    const counts = await this.events.countPinEvents(windows);
    const countsByRowId = new Map(counts.map((count) => [count.rowId, count]));
    return windows.map(({ pinId, rowId }) => {
      const count = countsByRowId.get(rowId);
      const impressions = count?.impressions ?? 0;
      const clicks = count?.clicks ?? 0;
      return {
        pinId,
        impressions,
        clicks,
        clickThroughRate: impressions === 0 ? 0 : clicks / impressions,
      };
    });
  }
}
