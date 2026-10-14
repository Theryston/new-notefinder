import { FlameIcon } from 'lucide-react';

/**
 * The toast of the streak milestone: a featured moment (DESIGN.md), a solid
 * brand block with heavy type, the one vibrant block on the screen. Sonner
 * places it; this is only its content.
 */
export function StreakCelebrationToast({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      role="status"
      data-testid="streak-celebration"
      className="flex w-80 max-w-[calc(100vw-1.5rem)] items-center gap-4 rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-xl"
    >
      <FlameIcon aria-hidden="true" className="size-9 shrink-0 fill-current" />
      <div className="flex min-w-0 flex-col">
        <p className="font-extrabold text-2xl leading-none tracking-tighter">
          {title}
        </p>
        <p className="mt-1 font-semibold text-sm">{description}</p>
      </div>
    </div>
  );
}
