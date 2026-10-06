/**
 * Up to two initials for an artist without a photo: the first letter of the
 * first and last words ("Billie Eilish" → "BE"). Artist names are always
 * present, so there is no fallback: a blank name yields an empty string.
 */
export function artistInitials(name: string): string {
  const words = name.match(/\S+/gu) ?? [];
  if (words.length === 0) {
    return '';
  }
  const last = words.length > 1 ? words.at(-1) : undefined;
  // Spread by code point, so accents and emoji aren't cut in half.
  return [words[0], last]
    .map((word) => word && [...word][0])
    .join('')
    .toLocaleUpperCase();
}
