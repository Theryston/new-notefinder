import { Injectable } from '@nestjs/common';
import { EventsAnalyticsService } from '../events/events-analytics.service.js';
import { EditorialPinMetricsRepository } from './editorial-pin-metrics.repository.js';

/** Pin engagement for the exact row id and configured time window. */
@Injectable()
export class EditorialPinMetricsService {
  constructor(
    private readonly pins: EditorialPinMetricsRepository,
    private readonly analytics: EventsAnalyticsService,
  ) {}

  async list() {
    return this.analytics.pinMetrics(await this.pins.findWindows(new Date()));
  }
}
