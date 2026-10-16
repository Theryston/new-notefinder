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
  private value: {
    judgments: ReturnType<PracticeScore['judgment']>[];
    summary: Summary;
    result: Summary | null;
    latest: ReturnType<PracticeScore['judgment']>;
  };

  constructor(private readonly notes: readonly TrackNote[]) {
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

  synchronize(playing: boolean, stopped: boolean): void {
    if (stopped) this.finish();
    else if (playing && !this.wasPlaying) this.begin();
    this.wasPlaying = playing;
  }

  begin(): void {
    if (this.active) return;
    this.active = true;
    this.latestIndex = -1;
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
    const summary = this.score.summary(this.settings);
    this.publish(this.loop ? null : summary);
  };

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
