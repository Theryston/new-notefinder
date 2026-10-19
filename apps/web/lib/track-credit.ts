import type { TrackArtistCreditEntry } from '@notefinder/contracts';

/**
 * The credit as the Recording prints it: each name followed by the join phrase
 * to the next one ("Queen feat. David Bowie"). The phrases are catalog data, not
 * translated text, so they are joined as they are.
 */
export function creditText(credit: readonly TrackArtistCreditEntry[]): string {
  return credit.map((entry) => `${entry.name}${entry.joinPhrase}`).join('');
}
