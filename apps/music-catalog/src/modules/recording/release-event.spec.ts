import type { ReleaseEventRow } from './recording-data.js';
import { pickReleaseEvent } from './release-event.js';

const event = (fields: Partial<ReleaseEventRow> = {}): ReleaseEventRow => ({
  releaseId: 1,
  country: null,
  year: null,
  month: null,
  day: null,
  ...fields,
});

describe('pickReleaseEvent', () => {
  it('has no date and no country without events', () => {
    expect(pickReleaseEvent([])).toEqual({ date: null, country: null });
  });

  it('takes the earliest event, country included', () => {
    const picked = pickReleaseEvent([
      event({ country: 'US', year: 1976, month: 2, day: 1 }),
      event({ country: 'GB', year: 1975, month: 11, day: 21 }),
      event({ country: 'JP', year: 1977 }),
    ]);

    expect(picked).toEqual({ date: '1975-11-21', country: 'GB' });
  });

  it('takes the less precise date first when it starts the same period', () => {
    const picked = pickReleaseEvent([
      event({ country: 'GB', year: 1975, month: 6 }),
      event({ country: 'US', year: 1975 }),
    ]);

    expect(picked).toEqual({ date: '1975', country: 'US' });
  });

  it('prefers a dated event to an undated one', () => {
    const picked = pickReleaseEvent([
      event({ country: 'FR' }),
      event({ country: 'DE', year: 2001 }),
    ]);

    expect(picked).toEqual({ date: '2001', country: 'DE' });
  });

  it('keeps an undated event of a known country when nothing has a date', () => {
    expect(pickReleaseEvent([event({ country: 'FR' })])).toEqual({
      date: null,
      country: 'FR',
    });
  });

  it('keeps an unknown country when its event is the earliest', () => {
    const picked = pickReleaseEvent([
      event({ country: 'FR', year: 1980 }),
      event({ year: 1970 }),
    ]);

    expect(picked).toEqual({ date: '1970', country: null });
  });

  it('breaks a tie by country code, whatever the order of the events', () => {
    const us = event({ country: 'US', year: 2000 });
    const gb = event({ country: 'GB', year: 2000 });
    const unknown = event({ year: 2000 });

    expect(pickReleaseEvent([us, unknown, gb]).country).toBe('GB');
    expect(pickReleaseEvent([gb, unknown, us]).country).toBe('GB');
    expect(pickReleaseEvent([unknown, us]).country).toBe('US');
  });
});
