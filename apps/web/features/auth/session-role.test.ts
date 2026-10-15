import { describe, expect, it } from 'vitest';

import { parseSessionUser } from './session';

describe('session role for restricted controls', () => {
  it.each(['ADMIN', 'USER'])('retains a recognized %s role', (role) => {
    expect(
      parseSessionUser({ user: { email: 'singer@example.com', role } })?.role,
    ).toBe(role);
  });
  it.each([undefined, 'admin', 'EDITOR', true])(
    'does not grant an invalid role: %j',
    (role) => {
      expect(
        parseSessionUser({ user: { email: 'singer@example.com', role } })?.role,
      ).toBeUndefined();
    },
  );
});
