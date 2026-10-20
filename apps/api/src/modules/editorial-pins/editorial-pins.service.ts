import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import {
  type CreateEditorialPinBody,
  createEditorialPinBodySchema,
  type EditorialPin,
  type EditorialPinActor,
  type EditorialPinHistoryEntry,
  type EditorialPinHistoryPage,
  type EditorialPinPage,
  type Locale,
  type UpdateEditorialPinBody,
} from '@notefinder/contracts';
import {
  decodeTupleCursor,
  encodeTupleCursor,
} from '../../common/cursor/tuple-cursor.js';
import { AppException } from '../../common/errors/app-exception.js';
import { EditorialPinScheduleService } from './editorial-pin-schedule.service.js';
import {
  affectedLocales,
  changedFieldsOf,
  EDITORIAL_PIN_STATE_FIELDS,
  type EditorialPinWrite,
  type PageCursor,
  stateOf,
  toEditorialPin,
} from './editorial-pin-state.js';
import {
  type EditorialPinHistoryRecord,
  type EditorialPinRecord,
  EditorialPinsRepository,
} from './editorial-pins.repository.js';

/** A page request: the cursor of the previous page, and how many items. */
type PageQuery = { cursor?: string | undefined; limit: number };

/** The page of `rows` that `limit` asks for, and the cursor of the next one. */
const cursorPageOf = <TRecord extends { createdAt: Date; id: string }, TItem>(
  rows: TRecord[],
  limit: number,
  toItem: (record: TRecord) => TItem,
): { items: TItem[]; nextCursor: string | null } => {
  const shown = rows.slice(0, limit);
  const last = rows.length > limit ? shown.at(-1) : undefined;
  return {
    items: shown.map(toItem),
    nextCursor: last
      ? encodeTupleCursor([last.createdAt.toISOString(), last.id])
      : null,
  };
};

const decodeCursor = (cursor: string | undefined): PageCursor | undefined => {
  if (cursor === undefined) {
    return undefined;
  }
  const [createdAt, id] = decodeTupleCursor(cursor);
  const time = new Date(createdAt);
  if (Number.isNaN(time.getTime())) {
    throw new AppException('VALIDATION_FAILED', 'Invalid cursor');
  }
  return { createdAt: time, id };
};

/** The fields of a validated body, as the database stores them. */
const writeOf = (body: CreateEditorialPinBody): EditorialPinWrite => ({
  kind: body.kind,
  layout: body.layout,
  position: body.position,
  priority: body.priority ?? 0,
  audience: body.audience ?? 'everyone',
  locale: body.locale ?? null,
  startsAt: body.startsAt ? new Date(body.startsAt) : null,
  endsAt: body.endsAt ? new Date(body.endsAt) : null,
  titles: body.titles,
  sponsored: body.sponsored ?? false,
  trackIds: body.source.trackIds,
});

const toHistoryEntry = (
  entry: EditorialPinHistoryRecord,
): EditorialPinHistoryEntry => ({
  id: entry.id,
  pinId: entry.pinId,
  action: entry.action,
  changedFields: entry.changedFields,
  actor: entry.actor,
  state: entry.state,
  createdAt: entry.createdAt.toISOString(),
});

/**
 * Why a Track cannot appear in a pin, or `undefined` when it can: it must have
 * completed its Processing, and a hero also needs a cover.
 */
const refusalOf = (
  kind: EditorialPinWrite['kind'],
  track: { coverUrl: string | null } | undefined,
): string | undefined => {
  if (!track) {
    return 'The Track has not completed its Processing or does not exist';
  }
  if (kind === 'hero' && track.coverUrl === null) {
    return 'A hero needs a Track with a cover';
  }
  return undefined;
};

/**
 * Admin writes of the editorial pins: validation, the history of every change,
 * and the cache invalidations that make a change show at once. Reads and writes
 * the pin as its admin sees it; the home reads the live ones through
 * `findLivePins`.
 */
@Injectable()
export class EditorialPinsService {
  constructor(
    private readonly pins: EditorialPinsRepository,
    private readonly schedule: EditorialPinScheduleService,
  ) {}

  async list(query: PageQuery): Promise<EditorialPinPage> {
    const rows = await this.pins.findPage({
      after: decodeCursor(query.cursor),
      limit: query.limit,
    });
    return cursorPageOf(rows, query.limit, toEditorialPin);
  }

  async get(pinId: string): Promise<EditorialPin> {
    return toEditorialPin(await this.require(pinId));
  }

  /** The changes of a pin, newest first. A removed pin keeps its history. */
  async history(
    pinId: string,
    query: PageQuery,
  ): Promise<EditorialPinHistoryPage> {
    const rows = await this.pins.findHistoryPage({
      pinId,
      after: decodeCursor(query.cursor),
      limit: query.limit,
    });
    // Every pin has a CREATED entry, and a removed pin keeps its entries, so an
    // empty first page means no pin ever had this ID.
    if (rows.length === 0 && query.cursor === undefined) {
      throw new AppException('NOT_FOUND', 'Home pin not found');
    }
    return cursorPageOf(rows, query.limit, toHistoryEntry);
  }

  async create(
    body: CreateEditorialPinBody,
    actor: EditorialPinActor,
  ): Promise<EditorialPin> {
    const write = writeOf(body);
    await this.assertTracksEligible(write);
    const pinId = await this.insertWithHistory(write, actor);
    const pin = toEditorialPin(await this.require(pinId));
    await this.announce(pin, pin.locale);
    return pin;
  }

  /** A partial update: the merged pin is checked as a whole, like a create. */
  async update(
    pinId: string,
    patch: UpdateEditorialPinBody,
    actor: EditorialPinActor,
  ): Promise<EditorialPin> {
    const current = await this.require(pinId);
    const currentState = toEditorialPin(current);
    const merged = createEditorialPinBodySchema.safeParse({
      ...currentState,
      ...patch,
    });
    if (!merged.success) {
      throw new AppException('VALIDATION_FAILED', 'The pin is invalid', {
        location: 'body',
        issues: merged.error.issues,
      });
    }
    const next = writeOf(merged.data);
    const changed = changedFieldsOf(currentState, stateOf(next));
    if (changed.length === 0) {
      return currentState;
    }
    if (changed.some((field) => ['kind', 'layout', 'source'].includes(field))) {
      await this.assertTracksEligible(next);
    }
    await this.updateWithHistory(pinId, next, changed, actor);
    const updated = toEditorialPin(await this.require(pinId));
    await this.announce(updated, current.locale);
    return updated;
  }

  async remove(pinId: string, actor: EditorialPinActor): Promise<void> {
    const current = await this.require(pinId);
    await this.deleteWithHistory(current, actor);
    await this.schedule.invalidateNow(affectedLocales(current.locale));
  }

  /**
   * The pins a request sees right now, in precedence order. Read at request
   * time, never stored in the feed: a pin starting or ending needs no
   * regeneration.
   */
  async findLivePins(options: {
    locale: Locale;
    signedIn: boolean;
    now?: Date;
  }): Promise<EditorialPin[]> {
    const rows = await this.pins.findLive({
      locale: options.locale,
      signedIn: options.signedIn,
      now: options.now ?? new Date(),
    });
    return rows.map((row) => toEditorialPin(row));
  }

  private async require(pinId: string): Promise<EditorialPinRecord> {
    const pin = await this.pins.findById(pinId);
    if (!pin) {
      throw new AppException('NOT_FOUND', 'Home pin not found');
    }
    return pin;
  }

  private async assertTracksEligible(write: EditorialPinWrite): Promise<void> {
    const found = new Map(
      (await this.pins.findCompletedTracks(write.trackIds)).map(
        (track) => [track.id, track] as const,
      ),
    );
    const issues = write.trackIds.flatMap((trackId) => {
      const message = refusalOf(write.kind, found.get(trackId));
      return message === undefined
        ? []
        : [{ code: 'custom', path: ['source', 'trackIds'], message, trackId }];
    });
    if (issues.length > 0) {
      throw new AppException(
        'VALIDATION_FAILED',
        'Some Tracks cannot appear in this pin',
        { location: 'custom', issues },
      );
    }
  }

  /** Revalidates the home of the locales the pin was and is in, now. */
  private async announce(
    pin: EditorialPin,
    previousLocale: Locale | null,
  ): Promise<void> {
    const locales = [
      ...new Set([
        ...affectedLocales(previousLocale),
        ...affectedLocales(pin.locale),
      ]),
    ];
    await this.schedule.invalidateNow(locales);
    await this.schedule.scheduleEdges(pin);
  }

  @Transactional()
  private async insertWithHistory(
    write: EditorialPinWrite,
    actor: EditorialPinActor,
  ): Promise<string> {
    const pinId = await this.pins.insertPin(write, actor.id);
    await this.pins.insertHistory({
      pinId,
      action: 'CREATED',
      changedFields: [...EDITORIAL_PIN_STATE_FIELDS],
      state: stateOf(write),
      actorId: actor.id,
    });
    return pinId;
  }

  @Transactional()
  private async updateWithHistory(
    pinId: string,
    write: EditorialPinWrite,
    changedFields: string[],
    actor: EditorialPinActor,
  ): Promise<void> {
    await this.pins.updatePin(pinId, write, actor.id);
    await this.pins.insertHistory({
      pinId,
      action: 'UPDATED',
      changedFields,
      state: stateOf(write),
      actorId: actor.id,
    });
  }

  @Transactional()
  private async deleteWithHistory(
    current: EditorialPinRecord,
    actor: EditorialPinActor,
  ): Promise<void> {
    await this.pins.insertHistory({
      pinId: current.id,
      action: 'DELETED',
      changedFields: [],
      state: stateOf(current),
      actorId: actor.id,
    });
    await this.pins.deletePin(current.id);
  }
}
