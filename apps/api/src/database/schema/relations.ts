import { relations } from 'drizzle-orm';
import { accounts, sessions } from './auth.js';
import { users } from './users.js';

// Relations for the relational query API live in one file so the table files
// never import each other in a cycle.

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));
