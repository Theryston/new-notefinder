import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@notefinder/contracts';
import { z } from 'zod';
import { AppException } from '../../common/errors/app-exception.js';
import { ENV, type Env } from '../../config/env.js';
import en from './locales/en.json' with { type: 'json' };
import ptBR from './locales/pt-BR.json' with { type: 'json' };

const sessionSchema = z.object({
  id: z.string(),
  livemode: z.literal(false),
  url: z.url().nullable(),
  status: z.enum(['open', 'complete', 'expired']),
  customer: z.string(),
  subscription: z.string().nullable(),
});
export type StripeCheckout = z.infer<typeof sessionSchema>;
const subscriptionSchema = z.object({
  id: z.string(),
  livemode: z.literal(false),
  customer: z.string(),
  status: z.enum([
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused',
  ]),
  currency: z.string(),
  cancel_at_period_end: z.boolean(),
  latest_invoice: z
    .object({
      status: z.string().nullable(),

      amount_paid: z.number(),
    })
    .nullable(),
  items: z.object({
    data: z
      .array(
        z.object({
          price: z.object({
            id: z.string(),
            unit_amount: z.number().nullable(),
            currency: z.string(),
          }),
          current_period_start: z.number(),
          current_period_end: z.number(),
        }),
      )
      .length(1),
  }),
});
export type StripeSubscription = z.infer<typeof subscriptionSchema>;

@Injectable()
export class StripeBillingService {
  constructor(@Inject(ENV) private readonly env: Env) {}
  async createCustomer(userId: string) {
    return z.object({ id: z.string(), livemode: z.literal(false) }).parse(
      await this.request(
        'customers',
        {
          'metadata[userId]': userId,
        },
        `customer-${userId}`,
      ),
    ).id;
  }
  async createCheckout(input: {
    id: string;
    customer: string;
    price: string;
    locale: Locale;
  }) {
    const base = `${this.env.WEB_URL}/${input.locale}/subscription`;
    return sessionSchema.parse(
      await this.request(
        'checkout/sessions',
        {
          mode: 'subscription',
          customer: input.customer,
          'line_items[0][price]': input.price,
          'line_items[0][quantity]': '1',
          success_url: `${base}?result=pending`,
          cancel_url: `${base}?result=cancelled`,
          locale: input.locale === 'pt-BR' ? 'pt-BR' : 'en',
          'metadata[contractId]': input.id,
          'custom_text[submit][message]': (input.locale === 'pt-BR' ? ptBR : en)
            .checkoutDisclosure,
        },
        `checkout-${input.id}`,
      ),
    );
  }
  async findCheckout(
    customer: string,
    contractId: string,
  ): Promise<StripeCheckout | null> {
    let cursor: string | undefined;
    do {
      const query = new URLSearchParams({
        customer,
        limit: '100',
        ...(cursor ? { starting_after: cursor } : {}),
      });
      const page = z
        .object({
          data: z.array(
            sessionSchema.extend({
              metadata: z.record(z.string(), z.string()),
            }),
          ),
          has_more: z.boolean(),
        })
        .parse(await this.request(`checkout/sessions?${query}`));
      const match = page.data.find(
        (session) => session.metadata.contractId === contractId,
      );
      if (match) return match;
      cursor = page.has_more ? page.data.at(-1)?.id : undefined;
      if (page.has_more && !cursor)
        throw new AppException(
          'SERVICE_UNAVAILABLE',
          'Stripe checkout reconciliation is incomplete',
        );
    } while (cursor);
    return null;
  }
  async getCheckout(id: string): Promise<StripeCheckout> {
    return sessionSchema.parse(
      await this.request(`checkout/sessions/${encodeURIComponent(id)}`),
    );
  }
  async expireCheckout(id: string): Promise<StripeCheckout> {
    return sessionSchema.parse(
      await this.request(
        `checkout/sessions/${encodeURIComponent(id)}/expire`,
        {},
      ),
    );
  }
  async getSubscription(id: string): Promise<StripeSubscription> {
    return subscriptionSchema.parse(
      await this.request(
        `subscriptions/${encodeURIComponent(id)}?expand[]=latest_invoice`,
      ),
    );
  }
  private async request(
    path: string,
    body?: Record<string, string>,
    key?: string,
  ): Promise<unknown> {
    if (!this.env.STRIPE_SECRET_KEY)
      throw new AppException(
        'SERVICE_UNAVAILABLE',
        'Stripe test configuration is missing',
      );
    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${this.env.STRIPE_SECRET_KEY}`,
        'Stripe-Version': '2025-06-30.basil',
        ...(body
          ? { 'Content-Type': 'application/x-www-form-urlencoded' }
          : {}),
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      ...(body ? { body: new URLSearchParams(body).toString() } : {}),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new AppException(
        'SERVICE_UNAVAILABLE',
        'Stripe billing request failed',
      );
    return response.json();
  }
}
