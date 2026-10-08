/**
 * The banner shared by the artist and album headers: a gradient surface,
 * an optional visual beside the text, the oversized title and the genre
 * chips. Stacked on phones, side by side from `sm`, with wrapping titles so
 * small screens never overflow horizontally.
 */

export const entityBannerClass =
  'overflow-hidden rounded-2xl bg-gradient-to-b from-muted via-muted/50 to-background px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10';

export const entityBannerRowClass =
  'flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6';

export const entityTitleClass =
  'min-w-0 break-words font-extrabold text-5xl tracking-tighter md:text-6xl';

/** Genre chips of a header; renders nothing when there are no genres. */
export function EntityGenreChips({
  genres,
  label,
}: {
  genres: readonly string[];
  label: string;
}) {
  if (genres.length === 0) {
    return null;
  }
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {genres.map((genre) => (
        <li
          key={genre}
          className="rounded-full bg-background px-3 py-1 font-medium text-muted-foreground text-xs shadow-xs"
        >
          {genre}
        </li>
      ))}
    </ul>
  );
}
