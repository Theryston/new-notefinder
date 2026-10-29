import { describe, expect, it } from 'vitest';
import { recoveryDeadline, renewalRecovery } from './renewal-recovery.js';

describe('failed renewal recovery', () => {
  const failed = {
    id: 'in_renewal',
    status: 'open',
    billing_reason: 'subscription_cycle',
    created: 1000,
    due_date: null,
  };
  it('retains the original deadline on retries', () => {
    const recovery = renewalRecovery({
      hasPaidInvoice: true,
      recoveryInvoiceId: null,
      recoveryStartedAt: null,
      providerStatus: 'past_due',
      paidConfirmed: false,
      invoice: failed,
    });
    expect(recovery.recoveryStartedAt).toEqual(new Date(1000000));
    expect(recoveryDeadline(recovery.recoveryStartedAt)).toEqual(
      new Date(260200000),
    );
    const retry = renewalRecovery({
      hasPaidInvoice: true,
      ...recovery,
      providerStatus: 'past_due',
      paidConfirmed: false,
      invoice: { ...failed, created: 2000 },
    });
    expect(retry).toEqual(recovery);
  });
  it('never grants a grace window to an unpaid initial charge or trial conversion', () => {
    expect(
      renewalRecovery({
        hasPaidInvoice: false,
        recoveryInvoiceId: null,
        recoveryStartedAt: null,
        providerStatus: 'past_due',
        paidConfirmed: false,
        invoice: failed,
      }).recoveryStartedAt,
    ).toBeNull();
  });
  it('clears a recovery window only on confirmed active payment', () => {
    const recovery = {
      recoveryInvoiceId: 'in_renewal',
      recoveryStartedAt: new Date(1000000),
    };
    expect(
      renewalRecovery({
        hasPaidInvoice: true,
        ...recovery,
        providerStatus: 'active',
        paidConfirmed: true,
        invoice: { ...failed, status: 'paid' },
      }).recoveryStartedAt,
    ).toBeNull();
    expect(
      renewalRecovery({
        hasPaidInvoice: true,
        ...recovery,
        providerStatus: 'unpaid',
        paidConfirmed: false,
        invoice: failed,
      }),
    ).toEqual(recovery);
  });
});
