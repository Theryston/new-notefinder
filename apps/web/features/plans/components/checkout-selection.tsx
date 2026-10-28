'use client';

import type { Plan } from '@notefinder/contracts';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { useRouter } from '@/lib/i18n/navigation';
import { useCheckout } from '../hooks/use-checkout';

type SelectionProps = {
  plan: Plan;
  loading: boolean;
  signedIn: boolean;
  ready: boolean;
};

export function CheckoutSelection({ plan }: { plan: Plan }) {
  if (plan.saleAvailable !== true) return null;
  return (
    <SessionUserBoundary
      render={(user, loading) => (
        <UserCheckoutSelection
          plan={plan}
          loading={loading}
          signedIn={Boolean(user)}
          ready={Boolean(user?.emailVerified && user.username)}
        />
      )}
    />
  );
}

function UserCheckoutSelection(props: SelectionProps) {
  const { plan, loading, signedIn, ready } = props;
  const t = useTranslations('billing');
  const router = useRouter();
  const checkout = useCheckout(plan.id);
  const busy = checkout.isPending;
  const resume = useResumeCheckout({ ...props, start: checkout.mutate });
  function choose(offer: Plan['offers'][number]) {
    if (!signedIn) {
      const query = new URLSearchParams({
        plan: plan.id,
        cycle: offer.cycle,
        offer: offer.id,
      });
      router.push({
        pathname: '/sign-in',
        query: { redirectTo: `/plans?${query}` },
      });
    } else if (ready && !busy) checkout.mutate(offer);
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {plan.offers.map((offer) => (
          <Button
            key={offer.id}
            disabled={loading || busy || (signedIn && !ready)}
            onClick={() => choose(offer)}
          >
            {t(
              busy && checkout.variables?.id === offer.id
                ? 'redirecting'
                : offer.cycle === 'annual'
                  ? 'chooseAnnual'
                  : 'chooseMonthly',
            )}
          </Button>
        ))}
      </div>
      {checkout.isError || resume.unavailable ? (
        <p role="alert">
          {t(resume.unavailable ? 'unavailable' : 'checkoutError')}
        </p>
      ) : null}
    </div>
  );
}

function useResumeCheckout({
  plan,
  loading,
  ready,
  start,
}: SelectionProps & { start: (offer: Plan['offers'][number]) => void }) {
  const search = useSearchParams();
  const router = useRouter();
  const attempted = useRef(false);
  const selected = search.get('plan') === plan.id;
  const offer = plan.offers.find(
    (item) =>
      item.id === search.get('offer') && item.cycle === search.get('cycle'),
  );
  // Returning from authentication only resumes the offer the visitor selected.
  useEffect(() => {
    if (loading || !ready || !selected || !offer || attempted.current) return;
    attempted.current = true;
    const query = new URLSearchParams(search);
    for (const key of ['plan', 'cycle', 'offer']) query.delete(key);
    router.replace(
      { pathname: '/plans', query: Object.fromEntries(query) },
      { scroll: false },
    );
    start(offer);
  }, [loading, ready, selected, offer, start, router, search]);
  return { unavailable: selected && !offer };
}
