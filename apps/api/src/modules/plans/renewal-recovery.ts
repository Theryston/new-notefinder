type Recovery = {
  recoveryInvoiceId: string | null;
  recoveryStartedAt: Date | null;
};
type Invoice = {
  id?: string;
  status: string | null;
  billing_reason?: string | null;
  created?: number;
  due_date?: number | null;
};

export function renewalRecovery(
  input: Recovery & {
    hasPaidInvoice: boolean;
    providerStatus: string;
    paidConfirmed: boolean;
    invoice: Invoice | null;
  },
): Recovery {
  if (input.paidConfirmed)
    return { recoveryInvoiceId: null, recoveryStartedAt: null };
  if (['canceled', 'incomplete_expired'].includes(input.providerStatus))
    return { recoveryInvoiceId: null, recoveryStartedAt: null };
  if (input.recoveryStartedAt)
    return {
      recoveryInvoiceId: input.recoveryInvoiceId,
      recoveryStartedAt: input.recoveryStartedAt,
    };
  const invoice = input.invoice;
  if (
    !input.hasPaidInvoice ||
    !['past_due', 'unpaid'].includes(input.providerStatus) ||
    !invoice?.id ||
    invoice.billing_reason !== 'subscription_cycle' ||
    invoice.status !== 'open' ||
    invoice.created === undefined
  )
    return { recoveryInvoiceId: null, recoveryStartedAt: null };
  return {
    recoveryInvoiceId: invoice.id,
    recoveryStartedAt: new Date((invoice.due_date ?? invoice.created) * 1000),
  };
}

export function recoveryDeadline(start: Date | null): Date | null {
  return start ? new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000) : null;
}
