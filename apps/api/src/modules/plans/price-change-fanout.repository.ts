import type { TransactionHost } from '@nestjs-cls/transactional';
import { sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { subscriptionPriceChanges } from '../../database/schema/subscriptions.js';

export async function fanOutPriceChanges(
  tx: TransactionHost<DatabaseAdapter>['tx'],
  selector: { planId: string } | { userId: string },
) {
  const scope =
    'planId' in selector
      ? sql`s.plan_id = ${selector.planId}`
      : sql`s.user_id = ${selector.userId}`;
  const candidates = await tx.execute<{
    subscriptionId: string;
    userId: string;
    oldPriceId: string;
    newPriceId: string;
    oldAmount: number;
    newAmount: number;
  }>(sql`
    select s.id as "subscriptionId", s.user_id as "userId", s.price_id as "oldPriceId",
      p.id as "newPriceId", s.amount as "oldAmount", p.amount as "newAmount"
    from subscriptions s
    join plan_prices p on p.plan_id = s.plan_id and p.cycle = s.cycle
      and p.currency = s.currency and p.current = true
    where ${scope} and s.price_id <> p.id and (
      s.amount <> p.amount or exists (
        select 1 from subscription_price_changes earlier
        where earlier.subscription_id = s.id
          and earlier.schedule_status in ('pending', 'failed', 'scheduled')
          and earlier.new_amount <> p.amount
      )
    )
      and s.stripe_subscription_id is not null and s.status = 'confirmed'
      and s.provider_status <> 'canceled' and s.cancel_at_period_end = false
  `);
  for (let offset = 0; offset < candidates.rows.length; offset += 500) {
    await tx
      .insert(subscriptionPriceChanges)
      .values(
        candidates.rows.slice(offset, offset + 500).map((row) => ({
          ...row,
          createdAt: sql`clock_timestamp()`,
        })),
      )
      .onConflictDoNothing({
        target: [
          subscriptionPriceChanges.subscriptionId,
          subscriptionPriceChanges.newPriceId,
        ],
      });
  }
}
