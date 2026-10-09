import {
  isNotePollBudgetSpent,
  isNotesStage,
  NOTE_POLL_INTERVAL_MS,
  unfinishedOutcomeOf,
} from './track-note-detection-polling.js';

describe('note detection polling', () => {
  it('checks a job every 5 seconds', () => {
    expect(NOTE_POLL_INTERVAL_MS).toBe(5_000);
  });

  it('spends the budget at the 120th check, 10 minutes of polling', () => {
    expect(isNotePollBudgetSpent(119)).toBe(false);
    expect(isNotePollBudgetSpent(120)).toBe(true);
  });

  describe('isNotesStage', () => {
    it('is true only for a running job that reported the notes stage', () => {
      expect(isNotesStage({ kind: 'running', stage: 'DETECTING_NOTES' })).toBe(
        true,
      );
      expect(
        isNotesStage({ kind: 'running', stage: 'EXTRACTING_VOCALS' }),
      ).toBe(false);
      expect(isNotesStage({ kind: 'running', stage: undefined })).toBe(false);
      expect(isNotesStage({ kind: 'failed' })).toBe(false);
      expect(isNotesStage({ kind: 'completed', output: null })).toBe(false);
    });
  });

  describe('unfinishedOutcomeOf', () => {
    it('checks a running job again after the poll interval', () => {
      expect(
        unfinishedOutcomeOf({ kind: 'running', stage: undefined }, 1),
      ).toEqual({ kind: 'wait', delayMs: 5_000, state: null });
    });

    it('ends the Processing with NOTE_DETECTION_FAILED when the job failed', () => {
      expect(unfinishedOutcomeOf({ kind: 'failed' }, 1)).toEqual({
        kind: 'failed',
        code: 'NOTE_DETECTION_FAILED',
      });
    });

    it('ends the Processing with NOTE_DETECTION_FAILED once the budget is spent', () => {
      expect(
        unfinishedOutcomeOf({ kind: 'running', stage: 'DETECTING_NOTES' }, 120),
      ).toEqual({ kind: 'failed', code: 'NOTE_DETECTION_FAILED' });
    });
  });
});
