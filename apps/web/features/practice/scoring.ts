import type { TrackNote } from '@notefinder/contracts';

export type Judgment = 'hit' | 'near' | 'miss';
export type ScoringSettings = {
  difficulty: 'EASY' | 'NORMAL' | 'HARD';
  octaveMode: 'ANY' | 'EXACT';
};
export const defaultScoring: ScoringSettings = {
  difficulty: 'NORMAL',
  octaveMode: 'ANY',
};
const TOLERANCE = { EASY: 75, NORMAL: 50, HARD: 25 };
type Votes = Record<Judgment, number>;

function classify(cents: number, settings: ScoringSettings): Judgment {
  const distance =
    settings.octaveMode === 'ANY'
      ? Math.abs((((cents % 1200) + 1800) % 1200) - 600)
      : Math.abs(cents);
  if (distance <= TOLERANCE[settings.difficulty]) return 'hit';
  return distance <= 100 ? 'near' : 'miss';
}

function addVotes(votes: Map<string, Votes>, cents: number): void {
  for (const difficulty of ['EASY', 'NORMAL', 'HARD'] as const) {
    for (const octaveMode of ['ANY', 'EXACT'] as const) {
      const key = `${difficulty}:${octaveMode}`;
      const counts = votes.get(key) ?? { hit: 0, near: 0, miss: 0 };
      counts[classify(cents, { difficulty, octaveMode })] += 1;
      votes.set(key, counts);
    }
  }
}

/** Pure scoring; target notes already include Transposition. */
export class PracticeScore {
  private readonly votes: Map<string, Votes>[];
  private skipped = false;

  constructor(
    private notes: readonly TrackNote[],
    private readonly loop = false,
  ) {
    this.votes = notes.map(() => new Map());
  }

  updateTargets(notes: readonly TrackNote[]): void {
    this.notes = notes;
  }

  record(time: number, midi: number | null): void {
    if (!Number.isFinite(time) || midi === null || !Number.isFinite(midi)) {
      return;
    }
    this.notes.forEach((note, index) => {
      const votes = this.votes[index];
      if (time < note.start || time >= note.end || !votes) return;
      addVotes(votes, (midi - note.pitch) * 100);
    });
  }

  seek(from: number, to: number): void {
    if (to > from) this.skipped = true;
  }

  judgment(index: number, settings = defaultScoring): Judgment | null {
    const counts = this.votes[index]?.get(
      `${settings.difficulty}:${settings.octaveMode}`,
    );
    if (!counts) return null;
    // A tie favors the less accurate category: it is not a majority hit.
    if (counts.hit > counts.near && counts.hit > counts.miss) return 'hit';
    return counts.near > counts.miss ? 'near' : 'miss';
  }

  summary(settings = defaultScoring) {
    const judgments = this.notes.map((_, index) =>
      this.judgment(index, settings),
    );
    const judged = judgments.filter((value) => value !== null).length;
    const hits = judgments.filter((value) => value === 'hit').length;
    const coverage = this.notes.length ? judged / this.notes.length : 0;
    return {
      accuracy: judged ? hits / judged : 0,
      judged,
      hits,
      coverage,
      forwardSkip: this.skipped,
      loop: this.loop,
      submittable: !this.loop && !this.skipped && coverage >= 0.9,
    };
  }
}
