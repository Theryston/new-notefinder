import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type {
  EditorialPinActor,
  EditorialPinAudience,
  EditorialPinHistoryAction,
  EditorialPinState,
  Locale,
} from '@notefinder/contracts';
import { and, asc, desc, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  editorialPinHistory,
  editorialPins,
  editorialPinTracks,
} from '../../database/schema/editorial-pins.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';
import { tracks } from '../../database/schema/tracks.js';
import type { EditorialPinWrite, PageCursor } from './editorial-pin-state.js';
import {
  actorOf,
  actorUser,
  createdAfter,
  createdAtMs,
  createdByUser,
  pinColumns,
  updatedByUser,
} from './editorial-pins-query.repository.js';

/** A stored pin, with its Tracks in order and who created and changed it. */
export type EditorialPinRecord = EditorialPinWrite & {
  id: string;
  createdBy: EditorialPinActor | null;
  updatedBy: EditorialPinActor | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EditorialPinHistoryRecord = {
  id: string;
  pinId: string;
  action: EditorialPinHistoryAction;
  changedFields: string[];
  actor: EditorialPinActor | null;
  state: EditorialPinState;
  createdAt: Date;
};

/** A pin row with the names of the admins who created and changed it. */
type PinRow = {
  pin: typeof editorialPins.$inferSelect;
  createdById: string | null;
  createdByName: string | null;
  updatedById: string | null;
  updatedByName: string | null;
};

/**
 * Editorial pins and their history. The only layer that touches the pin
 * tables; the Tracks of a pin are written together with the pin.
 */
@Injectable()
export class EditorialPinsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async findById(pinId: string): Promise<EditorialPinRecord | undefined> {
    const rows = await this.selectPins().where(eq(editorialPins.id, pinId));
    const [record] = await this.withTracks(rows);
    return record;
  }

  /** One page of pins, newest first. Reads `limit + 1` to tell if more follow. */
  async findPage(options: {
    after?: PageCursor;
    limit: number;
  }): Promise<EditorialPinRecord[]> {
    const rows = await this.selectPins()
      .where(
        createdAfter(
          createdAtMs(editorialPins.createdAt),
          editorialPins.id,
          options.after,
        ),
      )
      .orderBy(
        desc(createdAtMs(editorialPins.createdAt)),
        desc(editorialPins.id),
      )
      .limit(options.limit + 1);
    return this.withTracks(rows);
  }

  /**
   * The pins a request may see now: in its locale (or every locale), inside
   * their window, and in the audience of the request. Ordered by precedence.
   */
  async findLive(options: {
    locale: Locale;
    signedIn: boolean;
    now: Date;
  }): Promise<EditorialPinRecord[]> {
    const audiences: EditorialPinAudience[] = options.signedIn
      ? ['everyone']
      : ['everyone', 'visitors'];
    const rows = await this.selectPins()
      .where(
        and(
          or(
            isNull(editorialPins.locale),
            eq(editorialPins.locale, options.locale),
          ),
          or(
            isNull(editorialPins.startsAt),
            lte(editorialPins.startsAt, options.now),
          ),
          or(
            isNull(editorialPins.endsAt),
            gt(editorialPins.endsAt, options.now),
          ),
          inArray(editorialPins.audience, audiences),
        ),
      )
      .orderBy(
        desc(editorialPins.priority),
        desc(createdAtMs(editorialPins.createdAt)),
        asc(editorialPins.id),
      );
    return this.withTracks(rows);
  }

  /** The Tracks among `trackIds` that have completed their Processing. */
  findCompletedTracks(
    trackIds: string[],
  ): Promise<{ id: string; coverUrl: string | null }[]> {
    return this.txHost.tx
      .select({ id: tracks.id, coverUrl: tracks.coverUrl })
      .from(tracks)
      .where(
        and(inArray(tracks.id, trackIds), hasCompletedProcessing(tracks.id)),
      );
  }

  /** Writes a new pin with its Tracks and returns its ID. */
  async insertPin(write: EditorialPinWrite, actorId: string): Promise<string> {
    const [row] = await this.txHost.tx
      .insert(editorialPins)
      .values({
        ...pinColumns(write),
        createdById: actorId,
        updatedById: actorId,
      })
      .returning({ id: editorialPins.id });
    if (!row) {
      throw new Error('The insert of an editorial pin returned no row');
    }
    await this.insertTracks(row.id, write.trackIds);
    return row.id;
  }

  /** Replaces a pin's fields and Tracks. */
  async updatePin(
    pinId: string,
    write: EditorialPinWrite,
    actorId: string,
  ): Promise<void> {
    await this.txHost.tx
      .update(editorialPins)
      .set({ ...pinColumns(write), updatedById: actorId })
      .where(eq(editorialPins.id, pinId));
    await this.txHost.tx
      .delete(editorialPinTracks)
      .where(eq(editorialPinTracks.pinId, pinId));
    await this.insertTracks(pinId, write.trackIds);
  }

  async deletePin(pinId: string): Promise<void> {
    await this.txHost.tx
      .delete(editorialPins)
      .where(eq(editorialPins.id, pinId));
  }

  async insertHistory(entry: {
    pinId: string;
    action: EditorialPinHistoryAction;
    changedFields: string[];
    state: EditorialPinState;
    actorId: string;
  }): Promise<void> {
    await this.txHost.tx.insert(editorialPinHistory).values(entry);
  }

  /** One page of a pin's history, newest first. */
  async findHistoryPage(options: {
    pinId: string;
    after?: PageCursor;
    limit: number;
  }): Promise<EditorialPinHistoryRecord[]> {
    const createdAt = createdAtMs(editorialPinHistory.createdAt);
    const rows = await this.txHost.tx
      .select({
        id: editorialPinHistory.id,
        pinId: editorialPinHistory.pinId,
        action: editorialPinHistory.action,
        changedFields: editorialPinHistory.changedFields,
        state: editorialPinHistory.state,
        createdAt: editorialPinHistory.createdAt,
        actorId: actorUser.id,
        actorName: actorUser.name,
      })
      .from(editorialPinHistory)
      .leftJoin(actorUser, eq(editorialPinHistory.actorId, actorUser.id))
      .where(
        and(
          eq(editorialPinHistory.pinId, options.pinId),
          createdAfter(createdAt, editorialPinHistory.id, options.after),
        ),
      )
      .orderBy(desc(createdAt), desc(editorialPinHistory.id))
      .limit(options.limit + 1);
    return rows.map((row) => ({
      id: row.id,
      pinId: row.pinId,
      action: row.action,
      changedFields: row.changedFields,
      actor: actorOf(row.actorId, row.actorName),
      state: row.state,
      createdAt: row.createdAt,
    }));
  }

  private selectPins() {
    return this.txHost.tx
      .select({
        pin: editorialPins,
        createdById: createdByUser.id,
        createdByName: createdByUser.name,
        updatedById: updatedByUser.id,
        updatedByName: updatedByUser.name,
      })
      .from(editorialPins)
      .leftJoin(createdByUser, eq(editorialPins.createdById, createdByUser.id))
      .leftJoin(updatedByUser, eq(editorialPins.updatedById, updatedByUser.id));
  }

  /** Adds each pin's Tracks, in the order they were set, to its rows. */
  private async withTracks(rows: PinRow[]): Promise<EditorialPinRecord[]> {
    if (rows.length === 0) {
      return [];
    }
    const trackRows = await this.txHost.tx
      .select({
        pinId: editorialPinTracks.pinId,
        trackId: editorialPinTracks.trackId,
      })
      .from(editorialPinTracks)
      .where(
        inArray(
          editorialPinTracks.pinId,
          rows.map((row) => row.pin.id),
        ),
      )
      .orderBy(asc(editorialPinTracks.position));
    const trackIdsByPin = new Map<string, string[]>();
    for (const { pinId, trackId } of trackRows) {
      trackIdsByPin.set(pinId, [...(trackIdsByPin.get(pinId) ?? []), trackId]);
    }
    return rows.map(({ pin, ...actors }) => ({
      id: pin.id,
      kind: pin.kind,
      layout: pin.layout,
      position: pin.position,
      priority: pin.priority,
      audience: pin.audience,
      locale: pin.locale,
      startsAt: pin.startsAt,
      endsAt: pin.endsAt,
      titles: pin.titles,
      sponsored: pin.sponsored,
      trackIds: trackIdsByPin.get(pin.id) ?? [],
      createdBy: actorOf(actors.createdById, actors.createdByName),
      updatedBy: actorOf(actors.updatedById, actors.updatedByName),
      createdAt: pin.createdAt,
      updatedAt: pin.updatedAt,
    }));
  }

  private async insertTracks(pinId: string, trackIds: string[]): Promise<void> {
    await this.txHost.tx
      .insert(editorialPinTracks)
      .values(
        trackIds.map((trackId, position) => ({ pinId, trackId, position })),
      );
  }
}
