import type { TrackNote } from '@notefinder/contracts';
import { defaultScoring, PracticeScore, type ScoringSettings } from './scoring';

type Loop = { start: number; end: number } | null;
type Summary = ReturnType<PracticeScore['summary']>;

/** Owns run boundaries; snapshots change only when visible feedback changes. */
export class ScoreSession {
  private score: PracticeScore;
  private active = false;
  private wasPlaying = false;
  private latestIndex = -1;
  private settings: ScoringSettings = defaultScoring;
  private loop: Loop = null;
  private listeners = new Set<() => void>();
  /** The wall clock the current run started on, for the saved attempt. */
  private runStart: number | null = null;
  /** The wall clock the last run finished on, for the saved attempt. */
  private runEnd: number | null = null;
  private value: {
    judgments: ReturnType<PracticeScore['judgment']>[];
    summary: Summary;
    result: Summary | null;
    latest: ReturnType<PracticeScore['judgment']>;
  };

  constructor(private notes: readonly TrackNote[]) {
    this.score = new PracticeScore(notes);
    this.value = {
      judgments: [],
      summary: this.score.summary(),
      result: null,
      latest: null,
    };
  }

  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  updateTargets(notes: readonly TrackNote[]): void {
    const sameTimeline =
      notes.length === this.notes.length &&
      notes.every((note, index) => {
        const previous = this.notes[index];
        return previous?.start === note.start && previous.end === note.end;
      });
    this.notes = notes;
    if (sameTimeline) this.score.updateTargets(notes);
    else {
      this.score = new PracticeScore(notes, this.loop !== null);
      this.latestIndex = -1;
      this.publish(null);
    }
  }

  synchronize(playing: boolean, stopped: boolean): void {
    if (stopped) this.finish();
    else if (playing && !this.wasPlaying) this.begin();
    this.wasPlaying = playing;
  }

  begin(): void {
    if (this.active) return;
    this.active = true;
    this.latestIndex = -1;
    this.runStart = Date.now();
    this.runEnd = null;
    this.score = new PracticeScore(this.notes, this.loop !== null);
    this.publish(null);
  }

  record(time: number, midi: number | null): void {
    if (
      !this.active ||
      (this.loop && (time < this.loop.start || time >= this.loop.end))
    )
      return;
    if (midi !== null)
      this.latestIndex = this.notes.findIndex(
        (note) => note.start <= time && time < note.end,
      );
    this.score.record(time, midi);
    this.publish(this.value.result);
  }

  seek(from: number, to: number): void {
    if (!this.active) return;
    if (this.loop && to < from) {
      this.score = new PracticeScore(this.notes, true);
      this.latestIndex = -1;
      this.publish(null);
    } else this.score.seek(from, to);
  }

  setLoop(loop: Loop): void {
    if (loop?.start === this.loop?.start && loop?.end === this.loop?.end)
      return;
    const wasActive = this.active;
    this.loop = loop;
    this.active = false;
    if (wasActive) this.begin();
    else {
      this.score = new PracticeScore(this.notes, loop !== null);
      this.publish(null);
    }
  }

  setSettings(settings: ScoringSettings): void {
    this.settings = settings;
    this.publish(this.value.result ? this.score.summary(settings) : null);
  }

  finish = (): void => {
    if (!this.active) return;
    this.active = false;
    this.runEnd = Date.now();
    const summary = this.score.summary(this.settings);
    this.publish(this.loop ? null : summary);
  };

  /**
   * The wall-clock window of the last finished run, for the attempt the
   * page saves. Null before the first finish, and while a run is open.
   */
  runWindow(): { startedAt: number; endedAt: number } | null {
    return this.runStart !== null && this.runEnd !== null
      ? { startedAt: this.runStart, endedAt: this.runEnd }
      : null;
  }

  dismiss = (): void => this.publish(null);

  private publish(result: Summary | null): void {
    const judgments = this.notes.map((_, index) =>
      this.score.judgment(index, this.settings),
    );
    const summary = this.score.summary(this.settings);
    if (
      result === this.value.result &&
      summary.loop === this.value.summary.loop &&
      this.score.judgment(this.latestIndex, this.settings) ===
        this.value.latest &&
      judgments.every(
        (value, index) => value === this.value.judgments[index],
      ) &&
      judgments.length === this.value.judgments.length
    )
      return;
    this.value = {
      judgments,
      summary,
      result,
      latest: this.score.judgment(this.latestIndex, this.settings),
    };
    for (const listener of this.listeners) listener();
  }
}
