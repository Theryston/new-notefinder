import {
  assertSeedAllowed,
  buildSeedData,
  createRng,
  frequencyToMidi,
  fromMidi,
  generateVocalNotes,
  midiToFrequency,
  toMidi,
} from './seed-data.js';

describe('note math', () => {
  it('maps notes to MIDI numbers and back', () => {
    expect(toMidi('C', 4)).toBe(60);
    expect(toMidi('A', 4)).toBe(69);
    expect(toMidi('C#', 2)).toBe(37);
    expect(fromMidi(60)).toEqual({ note: 'C', octave: 4 });
    expect(fromMidi(83)).toEqual({ note: 'B', octave: 5 });
  });

  it('converts between MIDI numbers and frequencies (A4 = 440 Hz)', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(81)).toBeCloseTo(880);
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 2);
    expect(frequencyToMidi(261.63)).toBe(60);
    // Up to ~49 cents off still rounds to the same note.
    expect(frequencyToMidi(440 * 2 ** (40 / 1200))).toBe(69);
  });
});

describe('createRng', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    const values = Array.from({ length: 1000 }, () => a());
    expect(Array.from({ length: 1000 }, () => b())).toEqual(values);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(createRng(43)()).not.toBe(values[0]);
  });
});

describe('generateVocalNotes', () => {
  const options = {
    seed: 7,
    durationSeconds: 200,
    lowestMidi: toMidi('G', 3),
    highestMidi: toMidi('E', 5),
  };
  const notes = generateVocalNotes(options);

  it('is deterministic', () => {
    expect(generateVocalNotes(options)).toEqual(notes);
  });

  it('produces a few hundred notes', () => {
    expect(notes.length).toBeGreaterThan(150);
    expect(notes.length).toBeLessThan(600);
  });

  it('keeps notes ordered, non-overlapping and within the track', () => {
    let previousEnd = 0;
    for (const note of notes) {
      expect(note.start).toBeGreaterThanOrEqual(previousEnd);
      expect(note.end).toBeGreaterThan(note.start);
      expect(note.end).toBeLessThanOrEqual(options.durationSeconds);
      previousEnd = note.end;
    }
  });

  it('stays within the singer range with a matching frequency', () => {
    for (const note of notes) {
      const midi = toMidi(note.note, note.octave);
      expect(midi).toBeGreaterThanOrEqual(options.lowestMidi);
      expect(midi).toBeLessThanOrEqual(options.highestMidi);
      expect(frequencyToMidi(note.frequencyMean)).toBe(midi);
    }
  });
});

describe('buildSeedData', () => {
  const data = buildSeedData();

  it('is deterministic', () => {
    expect(buildSeedData()).toEqual(data);
  });

  it('uses unique IDs in every table', () => {
    for (const rows of Object.values(data)) {
      const ids = rows.map((row) => row.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('only references seeded rows', () => {
    const trackIds = new Set(data.tracks.map((track) => track.id));
    const artistIds = new Set(data.artists.map((artist) => artist.id));
    const albumIds = new Set(data.albums.map((album) => album.id));
    const userIds = new Set(data.users.map((user) => user.id));

    for (const track of data.tracks) {
      if (track.albumId != null) {
        expect(albumIds).toContain(track.albumId);
      }
      expect(userIds).toContain(track.creatorId);
    }
    for (const link of data.trackArtists) {
      expect(trackIds).toContain(link.trackId);
      expect(artistIds).toContain(link.artistId);
    }
    for (const row of [...data.thumbnails, ...data.trackNotes]) {
      expect(trackIds).toContain(row.trackId);
    }
  });

  it('gives notes only to completed tracks, within their duration', () => {
    for (const track of data.tracks) {
      const notes = data.trackNotes.filter((note) => note.trackId === track.id);
      if (track.status === 'COMPLETED') {
        expect(notes.length).toBeGreaterThan(100);
        const lastNote = notes.at(-1);
        expect(lastNote?.end).toBeLessThanOrEqual(track.durationSeconds ?? 0);
      } else {
        expect(notes).toHaveLength(0);
      }
    }
  });

  it('keeps note octaves between 2 and 5', () => {
    for (const note of data.trackNotes) {
      expect(note.octave).toBeGreaterThanOrEqual(2);
      expect(note.octave).toBeLessThanOrEqual(5);
    }
  });
});

describe('assertSeedAllowed', () => {
  it('refuses to run in production', () => {
    expect(() => assertSeedAllowed('production')).toThrowError(/production/);
    expect(() => assertSeedAllowed('development')).not.toThrow();
    expect(() => assertSeedAllowed('test')).not.toThrow();
  });
});
