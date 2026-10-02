import type { LrclibTrack } from '../../integrations/lrclib/lrclib-dump.js';
import { type MatchableRecording, matchLrclibTrack } from './match-lyrics.js';

const track = (overrides: Partial<LrclibTrack> = {}): LrclibTrack => ({
  id: 1,
  title: 'Yellow',
  artist: 'Coldplay',
  album: 'Parachutes',
  duration: 266,
  ...overrides,
});

const recording = (
  overrides: Partial<MatchableRecording> = {},
): MatchableRecording => ({
  mbid: '00000000-0000-4000-8000-000000000001',
  title: 'Yellow',
  lengthMs: 266_000,
  artistNames: ['Coldplay'],
  albumTitles: ['Parachutes'],
  ...overrides,
});

describe('matchLrclibTrack', () => {
  it('matches a track spelled differently but normalized the same', () => {
    const found = matchLrclibTrack(recording(), [
      track({ title: '  YELLOW!!', artist: 'coldplay' }),
    ]);

    expect(found?.id).toBe(1);
  });

  it.each([264, 268])(
    'matches a track %ss from the Recording, on the ±2s boundary',
    (duration) => {
      expect(matchLrclibTrack(recording(), [track({ duration })])?.id).toBe(1);
    },
  );

  it.each([263.999, 268.001])(
    'rejects a track %ss from the Recording, outside ±2s',
    (duration) => {
      expect(matchLrclibTrack(recording(), [track({ duration })])).toBe(
        undefined,
      );
    },
  );

  it('rejects a live title, a remix title and another artist', () => {
    const candidates = [
      track({ id: 2, title: 'Yellow (Live)' }),
      track({ id: 3, title: 'Yellow (Remix)' }),
      track({ id: 4, artist: 'Coldplay Tribute Band' }),
    ];

    expect(matchLrclibTrack(recording(), candidates)).toBe(undefined);
  });

  it('matches nothing when the Recording has no length', () => {
    expect(matchLrclibTrack(recording({ lengthMs: null }), [track()])).toBe(
      undefined,
    );
  });

  it('matches nothing when no candidate passes', () => {
    expect(matchLrclibTrack(recording(), [])).toBe(undefined);
  });

  it("breaks a tie by the album, picking the track on the Recording's album", () => {
    const found = matchLrclibTrack(recording(), [
      track({ id: 2, album: 'Greatest Hits' }),
      track({ id: 3, album: 'Parachutes' }),
    ]);

    expect(found?.id).toBe(3);
  });

  it("matches nothing when the tie has no track on the Recording's album", () => {
    const candidates = [
      track({ id: 2, album: 'Greatest Hits' }),
      track({ id: 3, album: 'Live in Paris' }),
    ];

    expect(matchLrclibTrack(recording(), candidates)).toBe(undefined);
  });

  it("matches nothing when two tied tracks share the Recording's album", () => {
    const candidates = [
      track({ id: 2, album: 'Parachutes', duration: 265 }),
      track({ id: 3, album: 'Parachutes', duration: 267 }),
    ];

    expect(matchLrclibTrack(recording(), candidates)).toBe(undefined);
  });

  it('matches a lone candidate even when the Recording is on no release', () => {
    const found = matchLrclibTrack(recording({ albumTitles: [] }), [track()]);

    expect(found?.id).toBe(1);
  });
});
