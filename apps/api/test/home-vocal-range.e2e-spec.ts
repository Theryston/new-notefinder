import request from 'supertest';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { createCompletedTrack } from './utils/track-processing-factories.js';

type Row = {
  id: string;
  layout: string;
  sponsored?: boolean;
  title?: { key: string; params: Record<string, string | number> };
  items?: { id: string; vocalRange: { lowest: number; highest: number } }[];
};

const getRows = async (testApp: TestApp): Promise<Row[]> => {
  const response = await request(testApp.app.getHttpServer())
    .get('/v1/home')
    .expect(200);
  return response.body.rows as Row[];
};

const voiceRowsOf = (rows: Row[]): Row[] =>
  rows.filter((row) => row.layout === 'vocal-range');

/** A completed Track of one voice, hottest last so the feed order is stable. */
const seedVoiceTrack = async (
  testApp: TestApp,
  voice: string,
  n: number,
  vocalRange: { vocalRangeLowest: number; vocalRangeHighest: number },
) =>
  createCompletedTrack(testApp.db, {
    title: `${voice} track ${n}`,
    artistCredit: [{ name: `${voice} artist ${n}`, joinPhrase: '' }],
    trendingScore: 0,
    // Older than the rangeless fillers, so the new row always eats those.
    createdAt: new Date('2020-01-01T00:00:00Z'),
    ...vocalRange,
  });

/** Six Tracks of each voice, plus twelve rangeless fillers the new row eats. */
const seedVoiceCatalog = async (testApp: TestApp) => {
  for (let n = 0; n < 6; n += 1) {
    await seedVoiceTrack(testApp, 'narrow', n, {
      vocalRangeLowest: 55,
      vocalRangeHighest: 60,
    });
    await seedVoiceTrack(testApp, 'high', n, {
      vocalRangeLowest: 66,
      vocalRangeHighest: 78,
    });
    await seedVoiceTrack(testApp, 'low', n, {
      vocalRangeLowest: 40,
      vocalRangeHighest: 52,
    });
  }
  const fillerIds: string[] = [];
  for (let n = 0; n < 12; n += 1) {
    const filler = await createCompletedTrack(testApp.db, {
      title: `filler track ${n}`,
      artistCredit: [{ name: `filler artist ${n}`, joinPhrase: '' }],
      trendingScore: 0,
    });
    fillerIds.push(filler.id);
  }
  return { fillerIds };
};

describe('Home feed by-voice rows (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
  });

  it('shows the three by-voice rows with their title keys', async () => {
    await seedVoiceCatalog(testApp);

    const rows = voiceRowsOf(await getRows(testApp));

    expect(rows.map((row) => [row.id, row.title?.key])).toEqual([
      ['by-voice-easy-start', 'home.rows.easyToStart'],
      ['by-voice-higher-voices', 'home.rows.higherVoices'],
      ['by-voice-lower-voices', 'home.rows.lowerVoices'],
    ]);
  });

  it('fills each row with six Tracks carrying their stored range', async () => {
    await seedVoiceCatalog(testApp);

    const rows = voiceRowsOf(await getRows(testApp));

    for (const row of rows) {
      expect(row.items).toHaveLength(6);
      for (const item of row.items ?? []) {
        expect(item.vocalRange.lowest).toBeLessThanOrEqual(
          item.vocalRange.highest,
        );
      }
    }
    const [easy, high, low] = rows;
    for (const item of easy?.items ?? []) {
      expect(
        item.vocalRange.highest - item.vocalRange.lowest,
      ).toBeLessThanOrEqual(9);
    }
    for (const item of high?.items ?? []) {
      expect(
        (item.vocalRange.lowest + item.vocalRange.highest) / 2,
      ).toBeGreaterThanOrEqual(64);
    }
    for (const item of low?.items ?? []) {
      expect(
        (item.vocalRange.lowest + item.vocalRange.highest) / 2,
      ).toBeLessThanOrEqual(53);
    }
  });

  it('shows no Track twice in the feed and no sponsored flag', async () => {
    await seedVoiceCatalog(testApp);

    const rows = await getRows(testApp);
    const ids = rows.flatMap((row) => (row.items ?? []).map((item) => item.id));

    expect(new Set(ids).size).toBe(ids.length);
    for (const row of voiceRowsOf(rows)) {
      expect(row).not.toHaveProperty('sponsored');
    }
  });

  it('never lists a Track without notes in a by-voice row', async () => {
    const { fillerIds } = await seedVoiceCatalog(testApp);

    const rows = voiceRowsOf(await getRows(testApp));
    const voiceIds = rows.flatMap(
      (row) => row.items?.map((item) => item.id) ?? [],
    );

    expect(voiceIds).toHaveLength(18);
    for (const fillerId of fillerIds) {
      expect(voiceIds).not.toContain(fillerId);
    }
  });

  it('drops a by-voice row with fewer than six qualifying Tracks', async () => {
    for (let n = 0; n < 3; n += 1) {
      await seedVoiceTrack(testApp, 'narrow', n, {
        vocalRangeLowest: 55,
        vocalRangeHighest: 60,
      });
    }

    expect(voiceRowsOf(await getRows(testApp))).toEqual([]);
  });
});
