/**
 * The banner shared by the artist and album headers, a featured block
 * (DESIGN.md "Featured blocks"): solid orange, white text and one ring as
 * decoration. The visual sits on the right, the oversized title and the
 * genre chips on the left. Stacked on phones, side by side from `sm`, with
 * wrapping titles so small screens never overflow horizontally.
 */

export const entityBannerClass =
  'relative isolate overflow-hidden rounded-2xl bg-primary px-4 py-6 text-primary-foreground before:pointer-events-none before:absolute before:-top-40 before:-right-40 before:-z-10 before:size-[30rem] before:rounded-full before:border-[4.5rem] before:border-black/15 sm:px-6 sm:py-8 md:px-8 md:py-10';

export const entityBannerRowClass =
  'flex min-w-0 flex-col gap-4 sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-6';

/** Sizes the visual (circle or cover) of a header, with its lift. */
export const entityVisualClass = 'size-24 shrink-0 sm:size-32 md:size-48';

/** Skeleton blocks on the orange banner, where `bg-muted` would clash. */
export const entitySkeletonClass = 'bg-primary-foreground/20';

/** The info lines under the title. */
export const entityInfoClass = 'font-semibold text-sm';

export const entityTitleClass =
  'min-w-0 break-words font-extrabold text-5xl leading-none tracking-tighter md:text-6xl';

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
          className="rounded-full border border-primary-foreground/40 px-3 py-1 font-semibold text-xs"
        >
          {genre}
        </li>
      ))}
    </ul>
  );
}
