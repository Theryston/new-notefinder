import { describe, expect, it } from 'vitest';
import { recoveryDeadline, renewalRecovery } from './renewal-recovery.js';

describe('failed renewal recovery', () => {
  const failed = {
    id: 'in_renewal',
    status: 'open',
    billing_reason: 'subscription_cycle',
    created: 500,
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
      failure: { invoiceId: 'in_renewal', occurredAt: 1000 },
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
      invoice: failed,
      failure: { invoiceId: 'in_renewal', occurredAt: 2000 },
    });
    expect(retry).toEqual(recovery);
    const older = renewalRecovery({
      hasPaidInvoice: true,
      ...retry,
      providerStatus: 'past_due',
      paidConfirmed: false,
      invoice: failed,
      failure: { invoiceId: 'in_renewal', occurredAt: 900 },
    });
    expect(older.recoveryStartedAt).toEqual(new Date(900000));
  });
  it('uses an explicit due date and ignores unrelated or missing failure events', () => {
    const input = {
      hasPaidInvoice: true,
      recoveryInvoiceId: null,
      recoveryStartedAt: null,
      providerStatus: 'past_due',
      paidConfirmed: false,
      invoice: { ...failed, due_date: 800 },
    };
    expect(
      renewalRecovery({
        ...input,
        failure: { invoiceId: 'in_renewal', occurredAt: 1000 },
      }).recoveryStartedAt,
    ).toEqual(new Date(800000));
    expect(
      renewalRecovery({ ...input, failure: null }).recoveryStartedAt,
    ).toBeNull();
    expect(
      renewalRecovery({
        ...input,
        failure: { invoiceId: 'in_other', occurredAt: 1000 },
      }).recoveryStartedAt,
    ).toBeNull();
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
        failure: { invoiceId: 'in_renewal', occurredAt: 1000 },
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
        failure: null,
      }).recoveryStartedAt,
    ).toBeNull();
    expect(
      renewalRecovery({
        hasPaidInvoice: true,
        ...recovery,
        providerStatus: 'unpaid',
        paidConfirmed: false,
        invoice: failed,
        failure: { invoiceId: 'in_renewal', occurredAt: 1000 },
      }),
    ).toEqual(recovery);
  });
});
