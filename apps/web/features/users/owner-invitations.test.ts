import { describe, expect, it } from 'vitest';

import { invitedSections } from './owner-invitations';

describe('invitedSections', () => {
  it('invites the owner to fill every visible section that is empty', () => {
    expect(invitedSections({ favorites: true, practiceHistory: true })).toEqual(
      ['favorites', 'practiceHistory'],
    );
  });

  it('invites nobody to a section that has content', () => {
    expect(
      invitedSections({ favorites: false, practiceHistory: true }),
    ).toEqual(['practiceHistory']);
    expect(
      invitedSections({ favorites: true, practiceHistory: false }),
    ).toEqual(['favorites']);
  });

  it('invites nobody when the section is unknown (hidden or unreadable)', () => {
    expect(
      invitedSections({ favorites: undefined, practiceHistory: undefined }),
    ).toEqual([]);
  });
});
