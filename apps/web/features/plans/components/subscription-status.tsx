'use client';

import type { Subscription } from '@vozzify/contracts';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { subscriptionState } from '../subscription-presentation';

export function SubscriptionStatus({
  subscription,
}: {
  subscription: Subscription | null;
}) {
  const t = useTranslations('billing.subscription');
  const state = subscriptionState(subscription);
  const recovery = subscription?.recoveryDeadline;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 font-semibold text-xs',
        {
          'bg-success/10 text-success': state === 'active' && !recovery,
          'bg-warning/10 text-warning':
            state === 'pending' ||
            state === 'ending' ||
            (Boolean(recovery) && Boolean(subscription?.paidMembership)),
          'bg-destructive/10 text-destructive': state === 'unsuccessful',
          'bg-muted text-muted-foreground':
            state === 'free' || state === 'ended',
        },
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      {t(
        `states.${recovery ? (subscription?.paidMembership ? 'overdue' : 'suspended') : state}`,
      )}
    </span>
  );
}
