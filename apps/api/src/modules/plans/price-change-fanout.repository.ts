import type { TransactionHost } from '@nestjs-cls/transactional';
import { sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';

export async function fanOutPriceChanges(
  tx: TransactionHost<DatabaseAdapter>['tx'],
  selector: { planId: string } | { userId: string },
) {
  const scope =
    'planId' in selector
      ? sql`s.plan_id = ${selector.planId}`
      : sql`s.user_id = ${selector.userId}`;
  await tx.execute(sql`
    insert into subscription_price_changes
      (id, subscription_id, user_id, old_price_id, new_price_id, old_amount, new_amount, created_at)
    select gen_random_uuid()::text, s.id, s.user_id, s.price_id, p.id, s.amount, p.amount, clock_timestamp()
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
    on conflict (subscription_id, new_price_id) do nothing
  `);
}
