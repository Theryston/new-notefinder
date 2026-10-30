'use client';

import type { Subscription } from '@vozzify/contracts';
import { useFormatter, useTranslations } from 'next-intl';

export function PriceChangeNotice({
  subscription,
}: {
  subscription: Subscription;
}) {
  const t = useTranslations('billing');
  const format = useFormatter();
  const change = subscription.pendingPriceChange;
  if (!change) return null;
  const amount = format.number(change.amount / 100, {
    style: 'currency',
    currency: change.currency,
  });
  const date = format.dateTime(new Date(change.effectiveAt), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
  return (
    <p role="status" className="rounded-xl bg-muted p-4 text-sm">
      {t(
        change.status === 'scheduled'
          ? 'priceChangeScheduled'
          : change.status === 'failed'
            ? 'priceChangeFailed'
            : 'priceChangePending',
        { amount, date },
      )}
    </p>
  );
}
