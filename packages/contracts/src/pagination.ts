import { z } from 'zod';

export const cursorPaginationQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>;

export const cursorPageSchema = <TItem extends z.ZodType>(item: TItem) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

export type CursorPage<TItem> = {
  items: TItem[];
  nextCursor: string | null;
};
