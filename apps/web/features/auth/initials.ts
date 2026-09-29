/**
 * Up to two letters for an avatar without a photo: first and last word of
 * `name` ("Ada Lovelace" → "AL"), or the first letter or digit of `fallback`
 * (the username or email) when there is no name.
 */
export function initials(name: string, fallback: string): string {
  const words = name.match(/\S+/gu) ?? [];
  if (words.length === 0) {
    return (fallback.match(/[\p{L}\p{N}]/u)?.[0] ?? '').toLocaleUpperCase();
  }
  const last = words.length > 1 ? words.at(-1) : undefined;
  // Spread by code point, so accents and emoji aren't cut in half.
  return [words[0], last]
    .map((word) => word && [...word][0])
    .join('')
    .toLocaleUpperCase();
}
