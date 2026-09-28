import { getTranslations } from 'next-intl/server';

export type AuthStep = 'signUp' | 'verifyEmail' | 'setupUsername';

// A short vocal line (C4 → G4) drawn as a piano roll, in SVG units. Lanes
// go from the highest note (0) down.
const LANES = ['G4', 'F4', 'E4', 'D4', 'C4'] as const;
const ROLL = { x: 40, width: 352, laneHeight: 24, noteHeight: 14 } as const;

const NOTES = [
  { lane: 4, start: 0, width: 44 },
  { lane: 3, start: 50, width: 32 },
  { lane: 2, start: 88, width: 54 },
  { lane: 3, start: 148, width: 28 },
  { lane: 2, start: 182, width: 36 },
  { lane: 1, start: 224, width: 40 },
  { lane: 0, start: 270, width: 82 },
] as const;

// Where the playhead sits on each step: the song advances as the user does.
const PLAYHEAD: Record<AuthStep, number> = {
  signUp: 66,
  verifyEmail: 160,
  setupUsername: 300,
};

type NoteState = 'past' | 'current' | 'upcoming';

function noteState(start: number, width: number, playhead: number): NoteState {
  if (start + width < playhead) return 'past';
  return start <= playhead ? 'current' : 'upcoming';
}

const NOTE_FILL: Record<NoteState, string> = {
  past: 'fill-primary-foreground/35',
  current: 'fill-primary-foreground',
  upcoming: 'fill-primary-foreground/75',
};

const laneY = (lane: number) => lane * ROLL.laneHeight + 5;

function NoteRoll({ step, label }: { step: AuthStep; label: string }) {
  const playhead = PLAYHEAD[step];

  return (
    <div className="rounded-xl bg-black/10 p-4 ring-1 ring-primary-foreground/10">
      <svg
        viewBox={`0 0 ${ROLL.x + ROLL.width} ${LANES.length * ROLL.laneHeight}`}
        role="img"
        aria-label={label}
        className="w-full font-mono"
      >
        {LANES.map((lane, index) => (
          <text
            key={lane}
            x={0}
            y={laneY(index) + ROLL.noteHeight / 2}
            dominantBaseline="central"
            className="fill-primary-foreground/70 text-[0.625rem]"
          >
            {lane}
          </text>
        ))}
        {NOTES.map((note) => {
          const state = noteState(note.start, note.width, playhead);
          const y = laneY(note.lane);
          return (
            <g key={`${note.lane}-${note.start}`}>
              <rect
                x={ROLL.x + note.start}
                y={y}
                width={note.width}
                height={ROLL.noteHeight}
                rx={3}
                className={NOTE_FILL[state]}
              />
              {state === 'current' && (
                <text
                  x={ROLL.x + note.start + 5}
                  y={y + ROLL.noteHeight / 2}
                  dominantBaseline="central"
                  className="fill-primary font-semibold text-[0.5625rem]"
                >
                  {LANES[note.lane]}
                </text>
              )}
            </g>
          );
        })}
        <rect
          x={ROLL.x + playhead - 1}
          y={0}
          width={2}
          height={LANES.length * ROLL.laneHeight}
          rx={1}
          className="fill-primary-foreground"
        />
      </svg>
    </div>
  );
}

/**
 * The one featured block of the auth screens (DESIGN.md "Featured blocks"):
 * solid orange, display type and a single ring as decoration, plus a small
 * note roll that advances with each step. Hidden below `lg`.
 */
export async function FeaturedPanel({ step }: { step: AuthStep }) {
  const t = await getTranslations('auth.featured');

  return (
    <aside className="relative m-3 hidden h-[calc(100svh-1.5rem)] flex-col justify-between overflow-hidden rounded-2xl bg-primary p-10 text-primary-foreground lg:sticky lg:top-3 lg:flex xl:p-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 -right-48 size-[34rem] rounded-full border-[4.5rem] border-primary-foreground/10"
      />
      <p className="relative font-semibold text-sm uppercase tracking-wider">
        {t(`${step}.overline`)}
      </p>
      <div className="relative flex max-w-lg flex-col gap-8">
        <NoteRoll step={step} label={t('timelineLabel')} />
        <div className="flex flex-col gap-4">
          <h2 className="font-extrabold text-5xl leading-none tracking-tighter xl:text-6xl">
            {t(`${step}.title`)}
          </h2>
          <p className="max-w-md font-semibold text-lg">
            {t(`${step}.description`)}
          </p>
        </div>
      </div>
    </aside>
  );
}
