import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ENV, type Env } from '../../config/env.js';
import type { EmailMessage } from './email.job.js';

const summarySchema = z.object({
  id: z.string(),
  to: z.array(z.string()),
  subject: z.string(),
  created_at: z.string(),
});
const pageSchema = z.object({
  has_more: z.boolean(),
  data: z.array(summarySchema),
});
const detailSchema = summarySchema.omit({ created_at: true }).extend({
  html: z.string().nullable(),
  text: z.string().nullable(),
  last_event: z.string(),
  tags: z.array(z.object({ name: z.string(), value: z.string() })),
});

type ReconciliationInput = {
  id: string;
  attempt: number;
  cursor: string | null;
  startedAt: Date;
  message: EmailMessage;
};

@Injectable()
export class PriceNoticeReconciliation {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async find(input: ReconciliationInput) {
    const query = new URLSearchParams({
      limit: '100',
      ...(input.cursor ? { after: input.cursor } : {}),
    });
    const page = pageSchema.parse(await this.get(`emails?${query}`));
    for (const entry of page.data) {
      const createdAt = Date.parse(entry.created_at);
      if (
        !Number.isFinite(createdAt) ||
        createdAt < input.startedAt.getTime() - 2 * 60 * 1000 ||
        createdAt >= input.startedAt.getTime() + 24 * 60 * 60 * 1000 ||
        entry.subject !== input.message.subject ||
        entry.to.length !== 1 ||
        entry.to[0] !== input.message.to
      )
        continue;
      const parsed = detailSchema.safeParse(
        await this.get(`emails/${encodeURIComponent(entry.id)}`),
      );
      if (!parsed.success) continue;
      const detail = parsed.data;
      if (
        detail.id === entry.id &&
        detail.to.length === 1 &&
        detail.to[0] === input.message.to &&
        detail.subject === input.message.subject &&
        detail.html === input.message.html &&
        detail.text === input.message.text &&
        ['sent', 'delivered', 'opened', 'clicked'].includes(
          detail.last_event,
        ) &&
        detail.tags.some(
          (tag) =>
            tag.name === 'price_notice' &&
            tag.value === `${input.id}-${input.attempt}`,
        )
      )
        return { found: true as const, cursor: null };
    }
    const exhausted = page.data.some(
      (entry) =>
        Date.parse(entry.created_at) <
        input.startedAt.getTime() - 2 * 60 * 1000,
    );
    const cursor = page.has_more && !exhausted ? page.data.at(-1)?.id : null;
    if (page.has_more && !exhausted && !cursor)
      throw new Error('Email reconciliation page has no cursor');
    return { found: false as const, cursor: cursor ?? null };
  }

  private async get(path: string): Promise<unknown> {
    if (!this.env.RESEND_API_KEY)
      throw new Error('Email provider is unavailable');
    const response = await fetch(`https://api.resend.com/${path}`, {
      headers: { Authorization: `Bearer ${this.env.RESEND_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new Error(
        `Email reconciliation failed with HTTP ${response.status}`,
      );
    return response.json();
  }
}
