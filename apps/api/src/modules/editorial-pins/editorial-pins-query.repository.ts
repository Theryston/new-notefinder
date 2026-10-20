import type { EditorialPinActor } from '@notefinder/contracts';
import { and, eq, lt, or, type SQL, sql } from 'drizzle-orm';
import { type AnyPgColumn, alias } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users.js';
import type { EditorialPinWrite, PageCursor } from './editorial-pin-state.js';

/** Millisecond precision, the one a cursor carries, so pages never skip a row. */
export const createdAtMs = (column: AnyPgColumn): SQL<Date> =>
  sql`date_trunc('milliseconds', ${column})`;

/** Rows after the cursor, newest first (the ID breaks a tie in creation time). */
export const createdAfter = (
  column: SQL<Date>,
  idColumn: AnyPgColumn,
  cursor: PageCursor | undefined,
): SQL | undefined =>
  cursor
    ? or(
        lt(column, cursor.createdAt),
        and(eq(column, cursor.createdAt), lt(idColumn, cursor.id)),
      )
    : undefined;

export const createdByUser = alias(users, 'created_by_user');
export const updatedByUser = alias(users, 'updated_by_user');
export const actorUser = alias(users, 'actor_user');

/** An admin, when the joined User row exists (a removed admin reads as none). */
export const actorOf = (
  id: string | null,
  name: string | null,
): EditorialPinActor | null =>
  id !== null && name !== null ? { id, name } : null;

/** The columns an insert or an update writes for a pin's own fields. */
export const pinColumns = (write: EditorialPinWrite) => ({
  kind: write.kind,
  layout: write.layout,
  position: write.position,
  priority: write.priority,
  audience: write.audience,
  locale: write.locale,
  startsAt: write.startsAt,
  endsAt: write.endsAt,
  titles: write.titles,
  sponsored: write.sponsored,
});
