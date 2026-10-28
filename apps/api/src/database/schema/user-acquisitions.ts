import type { CampaignTouch } from '@vozzify/contracts';
import { jsonb, pgTable, text, unique } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { users } from './users.js';

/**
 * The first and most recent campaign touch attached at sign-up. Legacy users
 * have no acquisition row because the old app did not collect these fields.
 */
export const userAcquisitions = pgTable(
  'user_acquisitions',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    firstTouch: jsonb().$type<CampaignTouch | null>(),
    lastTouch: jsonb().$type<CampaignTouch | null>(),
    ...timestamps,
  },
  (table) => [unique().on(table.userId)],
);

export type UserAcquisitionRow = typeof userAcquisitions.$inferSelect;
