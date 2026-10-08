import { describe, expect, it } from 'vitest';

import { arrivalStep } from './request-on-arrival';

const MBID = '00000000-0000-4000-8000-000000000002';
const OTHER = '00000000-0000-4000-8000-000000000003';
const ADA = { username: 'ada' };

describe('arrivalStep', () => {
  it('requests the marked Recording for a signed-in User with a username', () => {
    expect(
      arrivalStep({
        marker: MBID,
        signedIn: ADA,
        handled: null,
        alreadyRequested: false,
      }),
    ).toBe('request');
  });

  it('does nothing without a marker', () => {
    expect(
      arrivalStep({
        marker: null,
        signedIn: ADA,
        handled: null,
        alreadyRequested: false,
      }),
    ).toBe('wait');
  });

  it('waits while the session is still loading or the visitor is signed out', () => {
    expect(
      arrivalStep({
        marker: MBID,
        signedIn: null,
        handled: null,
        alreadyRequested: false,
      }),
    ).toBe('wait');
  });

  it('waits for the username step, which the API requires before a request', () => {
    expect(
      arrivalStep({
        marker: MBID,
        signedIn: { username: null },
        handled: null,
        alreadyRequested: false,
      }),
    ).toBe('wait');
  });

  it('acts on a marker once: the same one again is left alone', () => {
    expect(
      arrivalStep({
        marker: MBID,
        signedIn: ADA,
        handled: MBID,
        alreadyRequested: false,
      }),
    ).toBe('wait');
  });

  it('acts on a different marker even after another one was handled', () => {
    expect(
      arrivalStep({
        marker: OTHER,
        signedIn: ADA,
        handled: MBID,
        alreadyRequested: false,
      }),
    ).toBe('request');
  });

  it('clears a marker the tab already requested, without asking again', () => {
    expect(
      arrivalStep({
        marker: MBID,
        signedIn: ADA,
        handled: null,
        alreadyRequested: true,
      }),
    ).toBe('clear');
  });
});
