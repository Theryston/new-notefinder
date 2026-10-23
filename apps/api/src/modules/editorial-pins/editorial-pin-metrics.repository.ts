import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { DatabaseAdapter } from '../../database/database.js';
import { editorialPins } from '../../database/schema/editorial-pins.js';

export type EditorialPinMetricsWindow = {
  pinId: string;
  rowId: string;
  startsAt: Date;
  endsAt: Date;
};

/** Reads the pin periods that bound each pin's engagement counters. */
@Injectable()
export class EditorialPinMetricsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async findWindows(now: Date): Promise<EditorialPinMetricsWindow[]> {
    const pins = await this.txHost.tx
      .select({
        id: editorialPins.id,
        createdAt: editorialPins.createdAt,
        startsAt: editorialPins.startsAt,
        endsAt: editorialPins.endsAt,
      })
      .from(editorialPins);
    return pins.map(({ id, createdAt, startsAt, endsAt }) => ({
      pinId: id,
      rowId: `pin-${id}`,
      startsAt: startsAt ?? createdAt,
      endsAt: endsAt ?? now,
    }));
  }
}
