import { mbidSchema } from '@notefinder/contracts';
import {
  TINY_ARTIST_COUNT,
  TINY_RECORDING_COUNT,
  tinyArtistCreditMbid,
  tinyArtistMbid,
  tinyRecordingMbid,
  tinySeedRecordings,
} from './tiny-seed.js';

describe('tinySeedRecordings', () => {
  it('seeds a few hundred recordings from twenty artists', () => {
    const recordings = tinySeedRecordings();

    expect(recordings).toHaveLength(TINY_RECORDING_COUNT);
    expect(TINY_RECORDING_COUNT).toBe(300);
    expect(new Set(recordings.map((entry) => entry.artistMbid))).toHaveLength(
      TINY_ARTIST_COUNT,
    );
  });

  it('is deterministic: the same index always yields the same entry', () => {
    expect(tinySeedRecordings()).toEqual(tinySeedRecordings());
    expect(tinySeedRecordings(10)).toEqual(tinySeedRecordings().slice(0, 10));
  });

  it('gives every recording a unique MBID, title and length', () => {
    const recordings = tinySeedRecordings();

    expect(new Set(recordings.map((entry) => entry.mbid))).toHaveLength(
      recordings.length,
    );
    expect(new Set(recordings.map((entry) => entry.title))).toHaveLength(
      recordings.length,
    );
    for (const entry of recordings) {
      expect(() => mbidSchema.parse(entry.mbid)).not.toThrow();
      expect(() => mbidSchema.parse(entry.artistMbid)).not.toThrow();
      expect(entry.lengthMs).toBeGreaterThan(0);
    }
  });

  it('keeps an artist and its credit on fixed MBIDs', () => {
    const recordings = tinySeedRecordings();
    const first = recordings[0];

    expect(first?.title).toBe('Tiny Song 001');
    expect(first?.mbid).toBe(tinyRecordingMbid(1));
    expect(first?.artistName).toBe('Tiny Artist 01');
    expect(first?.artistMbid).toBe(tinyArtistMbid(1));
    expect(tinyArtistCreditMbid(1)).not.toBe(tinyArtistMbid(1));
    expect(() => mbidSchema.parse(tinyArtistCreditMbid(1))).not.toThrow();
  });
});
