import { MicIcon, PlayIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { LogoMark } from '@/components/logo-mark';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

const notes = [
  { pitch: 'A3', start: 0, length: 15, lane: 4, phase: 'past' },
  { pitch: 'B3', start: 16, length: 12, lane: 3, phase: 'past' },
  { pitch: 'C4', start: 30, length: 21, lane: 2, phase: 'current' },
  { pitch: 'D4', start: 53, length: 16, lane: 1, phase: 'upcoming' },
  { pitch: 'E4', start: 70, length: 14, lane: 0, phase: 'upcoming' },
  { pitch: 'C4', start: 85, length: 15, lane: 2, phase: 'upcoming' },
] as const;
const noteClasses = {
  past: 'bg-timeline-note-past text-foreground',
  current: 'bg-primary text-primary-foreground',
  upcoming: 'border border-border bg-muted text-muted-foreground',
};

export async function PlanPracticePreview() {
  const t = await getTranslations('plans.preview');
  return (
    <figure
      aria-label={t('illustration')}
      className="space-y-5 rounded-2xl bg-card p-5 shadow-sm md:p-6"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted">
          <LogoMark className="size-8" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-sm">{t('title')}</p>
          <p className="text-muted-foreground text-xs">{t('description')}</p>
        </div>
        <Link
          href="/search"
          aria-label={t('findSong')}
          title={t('findSong')}
          className={buttonVariants({
            size: 'icon',
            className: 'ml-auto shrink-0',
          })}
        >
          <PlayIcon aria-hidden className="size-4 fill-current" />
        </Link>
      </div>
      <div className="space-y-3">
        <div
          className="flex items-center justify-between gap-3 font-mono text-xs tabular-nums"
          aria-hidden
        >
          <span>
            00:42 <span className="text-muted-foreground">/ 05:02</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="font-sans text-muted-foreground text-xs uppercase tracking-wide">
              {t('currentNote')}
            </span>
            <span className="font-semibold text-primary">C4</span>
          </span>
        </div>
        <PreviewTimeline />
      </div>
      <figcaption className="flex items-center justify-between text-muted-foreground text-xs">
        <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
          <MicIcon aria-hidden className="size-3.5" />
          {t('microphone')}
        </span>
        <span className="font-mono tabular-nums" aria-hidden>
          1×
        </span>
      </figcaption>
    </figure>
  );
}

function PreviewTimeline() {
  return (
    <div
      className="flex h-36 overflow-hidden rounded-xl border border-border bg-background"
      aria-hidden
    >
      <div className="grid w-8 shrink-0 grid-rows-5 bg-muted font-mono text-muted-foreground text-xs">
        {['E4', 'D4', 'C4', 'B3', 'A3'].map((pitch) => (
          <span
            key={pitch}
            className="flex items-center justify-center border-border border-b last:border-b-0"
          >
            {pitch}
          </span>
        ))}
      </div>
      <div className="relative grid min-w-0 flex-1 grid-rows-5">
        {['E4', 'D4', 'C4', 'B3', 'A3'].map((pitch) => (
          <span
            key={pitch}
            className="border-border border-b last:border-b-0"
          />
        ))}
        {notes.map((note) => (
          <span
            key={`${note.pitch}-${note.start}`}
            className={`absolute mt-0.5 h-6 overflow-hidden rounded-xs px-1 py-0.5 font-mono text-xs ${noteClasses[note.phase]}`}
            style={{
              left: `${note.start}%`,
              width: `${note.length}%`,
              top: `${note.lane * 20}%`,
            }}
          >
            {note.pitch}
          </span>
        ))}
        <span className="absolute top-0 bottom-0 left-[42%] w-px bg-foreground/60" />
      </div>
    </div>
  );
}
