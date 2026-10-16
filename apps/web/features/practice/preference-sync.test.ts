import { describe, expect, it } from 'vitest';

import { applyAccountPreferences, changedPreferences } from './preference-sync';
import { scoringSettings } from './stores/scoring-settings';
import { singingAidsStore } from './stores/singing-aids-store';

describe('changedPreferences', () => {
  it('keeps only what the account does not hold yet', () => {
    expect(
      changedPreferences(
        { difficulty: 'NORMAL', octaveMode: 'ANY' },
        { difficulty: 'HARD', octaveMode: 'ANY' },
      ),
    ).toEqual({ difficulty: 'HARD' });
  });

  it('keeps nothing when nothing changed, so adopting never echoes', () => {
    const account = {
      difficulty: 'HARD',
      octaveMode: 'EXACT',
      guideMelody: true,
      countIn: false,
    } as const;

    expect(changedPreferences({ ...account }, { ...account })).toEqual({});
    expect(changedPreferences({}, {})).toEqual({});
  });
});

describe('applyAccountPreferences', () => {
  it('writes the account values into the stores', () => {
    scoringSettings.setState({ difficulty: 'NORMAL', octaveMode: 'ANY' });
    singingAidsStore.setState({
      countIn: true,
      guideMelody: false,
      guideMelodyManual: false,
      offset: 0,
    });

    applyAccountPreferences({
      difficulty: 'HARD',
      octaveMode: 'EXACT',
      guideMelody: true,
      countIn: false,
    });

    expect(scoringSettings.getState()).toEqual({
      difficulty: 'HARD',
      octaveMode: 'EXACT',
    });
    expect(singingAidsStore.getState()).toMatchObject({
      countIn: false,
      guideMelody: true,
    });
  });
});
