/** The sections whose empty state invites the owner to fill them. */
export type InvitedSection = 'favorites' | 'practiceHistory';

/**
 * The sections the owner is invited to fill. `true` means the visitor's view of
 * the section is empty; `undefined` means it is unknown (hidden from visitors or
 * unreadable), so nothing is invited: the owner's own answer is not read here.
 */
export function invitedSections(empty: {
  favorites: boolean | undefined;
  practiceHistory: boolean | undefined;
}): InvitedSection[] {
  const sections: InvitedSection[] = [];
  if (empty.favorites === true) sections.push('favorites');
  if (empty.practiceHistory === true) sections.push('practiceHistory');
  return sections;
}
