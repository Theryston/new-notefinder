import { describe, expect, it } from 'vitest';

import { recordingToRequestOnArrival } from './request-on-arrival';

const MBID = '00000000-0000-4000-8000-000000000002';
const ADA = { username: 'ada' };

describe('recordingToRequestOnArrival', () => {
  it('requests the marked Recording for a signed-in User with a username', () => {
    expect(
      recordingToRequestOnArrival({
        marker: MBID,
        signedIn: ADA,
        requested: null,
      }),
    ).toBe(MBID);
  });

  it('asks nothing without a marker', () => {
    expect(
      recordingToRequestOnArrival({
        marker: null,
        signedIn: ADA,
        requested: null,
      }),
    ).toBeNull();
  });

  it('waits while the session is still loading or the visitor is signed out', () => {
    expect(
      recordingToRequestOnArrival({
        marker: MBID,
        signedIn: null,
        requested: null,
      }),
    ).toBeNull();
  });

  it('waits for the username step, which the API requires before a request', () => {
    expect(
      recordingToRequestOnArrival({
        marker: MBID,
        signedIn: { username: null },
        requested: null,
      }),
    ).toBeNull();
  });

  it('requests a marker once: the same one again is not asked twice', () => {
    expect(
      recordingToRequestOnArrival({
        marker: MBID,
        signedIn: ADA,
        requested: MBID,
      }),
    ).toBeNull();
  });

  it('requests a different marker even after another one was requested', () => {
    const other = '00000000-0000-4000-8000-000000000003';

    expect(
      recordingToRequestOnArrival({
        marker: other,
        signedIn: ADA,
        requested: MBID,
      }),
    ).toBe(other);
  });
});
