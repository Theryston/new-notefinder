import { cn } from '@/lib/utils';

import { coverPlaceholder } from '../track-cover';

type ShapeColors = { c1: string; c2: string; c3: string };

function ShapeDisc({ c1, c2, c3 }: ShapeColors) {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 28% 18%, ${c3} 0%, transparent 55%), linear-gradient(135deg, ${c2} 0%, ${c2} 68%, ${c1} 135%)`,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute -right-[20%] -bottom-[20%] aspect-square w-[62%] rounded-full"
        style={{ backgroundColor: c1, opacity: 0.85 }}
      />
    </>
  );
}

function ShapeBand({ c1, c2, c3 }: ShapeColors) {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${c2} 0%, ${c2} 52%, ${c3} 125%)`,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[22%]"
        style={{
          background: `linear-gradient(180deg, ${c1} 0%, transparent 100%)`,
          opacity: 0.35,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute top-[42%] right-0 left-0 h-[18%]"
        style={{ backgroundColor: c3, opacity: 0.55 }}
      />
      <span
        aria-hidden="true"
        className="absolute top-[60%] right-0 left-0 h-[8%]"
        style={{ backgroundColor: c3, opacity: 0.3 }}
      />
    </>
  );
}

function ShapeSquare({ c1, c2, c3 }: ShapeColors) {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `linear-gradient(120deg, ${c2} 0%, ${c3} 95%)`,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[38%]"
        style={{
          background: `linear-gradient(90deg, ${c1} 0%, transparent 100%)`,
          opacity: 0.5,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 m-auto aspect-[4/3] w-[44%] rounded-[4px] border-[3px] border-white/50"
      />
    </>
  );
}

function ShapeRing({ c1, c2, c3 }: ShapeColors) {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 35%, ${c3} 0%, ${c2} 58%, ${c2} 100%)`,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent 58%, ${c1} 138%)`,
          opacity: 0.55,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 m-auto aspect-square w-[62%] rounded-full border-[3px] border-white/40"
        style={{ boxShadow: 'inset 0 0 32px rgb(255 255 255 / 0.22)' }}
      />
    </>
  );
}

function ShapeStripes({ c1, c2, c3 }: ShapeColors) {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${c2} 0%, ${c2} 68%, ${c3} 132%)`,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `linear-gradient(315deg, ${c1} 0%, transparent 32%)`,
          opacity: 0.6,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'repeating-linear-gradient(115deg, transparent 0 10px, rgb(255 255 255 / 0.18) 10px 12px)',
        }}
      />
    </>
  );
}

function ShapeOrb({ c1, c2, c3 }: ShapeColors) {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 28% 16%, ${c3} 0%, transparent 52%), linear-gradient(135deg, ${c2} 0%, ${c2} 72%, ${c3} 125%)`,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute -right-[24%] -bottom-[24%] aspect-square w-[60%] rounded-full"
        style={{ backgroundColor: c1, opacity: 0.8 }}
      />
    </>
  );
}

function VariantShape({
  variant,
  c1,
  c2,
  c3,
}: ShapeColors & { variant: number }) {
  if (variant === 1) return <ShapeBand c1={c1} c2={c2} c3={c3} />;
  if (variant === 2) return <ShapeSquare c1={c1} c2={c2} c3={c3} />;
  if (variant === 3) return <ShapeRing c1={c1} c2={c2} c3={c3} />;
  if (variant === 4) return <ShapeStripes c1={c1} c2={c2} c3={c3} />;
  if (variant === 5) return <ShapeOrb c1={c1} c2={c2} c3={c3} />;
  return <ShapeDisc c1={c1} c2={c2} c3={c3} />;
}

/**
 * Artwork stand-in when a Recording has no cover: a curated gradient plus
 * one geometric shape (disc, band, square, ring, stripes), deterministic
 * by seed. The vivid tone dominates and the dark tone stays a small accent,
 * so the grid reads bright like real artwork. Real covers still render as
 * photos; this only fills the gap.
 */
export function TrackCoverPlaceholder({
  seed,
  className,
}: {
  seed: string;
  className?: string;
}) {
  const { variant, c1, c2, c3 } = coverPlaceholder(seed);

  return (
    <span
      aria-hidden="true"
      className={cn('absolute inset-0 overflow-hidden', className)}
      style={{ backgroundColor: c2 }}
    >
      <VariantShape variant={variant} c1={c1} c2={c2} c3={c3} />
    </span>
  );
}
