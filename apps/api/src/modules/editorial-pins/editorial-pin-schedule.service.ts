import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import {
  cacheTags,
  type EditorialPin,
  type Locale,
} from '@notefinder/contracts';
import type { Queue } from 'bullmq';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { affectedLocales } from './editorial-pin-state.js';
import {
  EDITORIAL_PIN_QUEUE,
  INVALIDATE_HOME_FOR_PIN_JOB,
  type InvalidateHomeForPinJob,
} from './editorial-pins.job.js';

/** Keeps the last failed invalidations around to be inspected. */
const KEPT_FAILED_JOBS = 500;

/**
 * Asks the web to revalidate the home of some locales: at once after a change
 * to a pin, and at the exact start and end of a pin that is still ahead.
 */
@Injectable()
export class EditorialPinScheduleService {
  constructor(
    @InjectQueue(EDITORIAL_PIN_QUEUE)
    private readonly queue: Queue<InvalidateHomeForPinJob>,
    private readonly revalidation: WebRevalidationService,
  ) {}

  invalidateNow(locales: readonly Locale[]): Promise<void> {
    return this.revalidation.revalidate(
      locales.map((locale) => cacheTags.home(locale)),
    );
  }

  /**
   * Schedules the start and the end of the pin when they are ahead of `now`.
   * A job for a time that has since changed still runs: it only revalidates,
   * which is harmless, so no job is removed on an edit.
   */
  async scheduleEdges(pin: EditorialPin, now = new Date()): Promise<void> {
    const edges = [
      { edge: 'start', at: pin.startsAt },
      { edge: 'end', at: pin.endsAt },
    ] as const;
    await Promise.all(
      edges.map(({ edge, at }) => this.scheduleEdge(pin, edge, at, now)),
    );
  }

  private async scheduleEdge(
    pin: EditorialPin,
    edge: 'start' | 'end',
    at: string | null,
    now: Date,
  ): Promise<void> {
    if (at === null) {
      return;
    }
    const time = Date.parse(at);
    const delay = time - now.getTime();
    if (delay <= 0) {
      return;
    }
    await this.queue.add(
      INVALIDATE_HOME_FOR_PIN_JOB,
      { locales: affectedLocales(pin.locale) },
      {
        // One job per pin edge and time: scheduling the same edge twice is a no-op.
        jobId: `editorial-pin-${pin.id}-${edge}-${time}`,
        delay,
        removeOnComplete: true,
        removeOnFail: KEPT_FAILED_JOBS,
      },
    );
  }
}
