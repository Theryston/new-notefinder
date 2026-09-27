import { createId } from '@paralleldrive/cuid2';
import { text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Text primary key. New rows get a cuid2; imported legacy rows keep their
 * Prisma cuid, which fits the same column (see "Legacy data import").
 */
export const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => createId());

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
