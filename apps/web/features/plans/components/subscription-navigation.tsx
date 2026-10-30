'use client';

import { useLocale } from 'next-intl';
import type { ReactNode } from 'react';
import { useSubscription } from '../hooks/use-billing';

export function SubscriptionNavigation({
  userId,
  render,
}: {
  userId: string;
  render: (subscribed: boolean) => ReactNode;
}) {
  const locale = useLocale();
  const { data } = useSubscription(userId, locale);
  return render(Boolean(data?.subscription?.paidMembership));
}
