import { AppException } from '../../common/errors/app-exception.js';
import type {
  StripeBillingService,
  StripeSubscription,
} from '../../integrations/stripe/stripe-billing.service.js';

type FailureEvent = {
  type: string;
  created?: number;
  data: { object: { id?: string } };
};
export async function renewalFailure(input: {
  stripe: StripeBillingService;
  customer: string;
  provider: StripeSubscription;
  event: FailureEvent;
  hasPaidInvoice: boolean;
  recoveryStartedAt: Date | null;
}) {
  const { event, provider } = input;
  const invoice = provider.latest_invoice;
  if (
    !input.hasPaidInvoice ||
    !['past_due', 'unpaid'].includes(provider.status) ||
    !invoice?.id ||
    invoice.billing_reason !== 'subscription_cycle' ||
    invoice.status !== 'open'
  )
    return null;
  const matchingEvent =
    event.type === 'invoice.payment_failed' &&
    event.data.object.id === invoice.id &&
    event.created !== undefined;
  if (input.recoveryStartedAt)
    return matchingEvent
      ? { invoiceId: invoice.id, occurredAt: event.created ?? 0 }
      : null;
  if (invoice.due_date != null)
    return { invoiceId: invoice.id, occurredAt: invoice.due_date };

  if (invoice.created === undefined)
    throw new AppException(
      'SERVICE_UNAVAILABLE',
      'Stripe invoice creation time is missing',
    );
  return {
    invoiceId: invoice.id,
    occurredAt: await input.stripe.firstInvoiceFailure({
      invoiceId: invoice.id,
      customer: input.customer,
      invoiceCreated: invoice.created,
      latestFailure: Math.floor(Date.now() / 1000),
    }),
  };
}
