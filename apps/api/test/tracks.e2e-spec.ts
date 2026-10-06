import { searchResultItemSchema } from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import { legacyTrackIds, tracks } from '../src/database/schema/tracks.js';
import { TracksService } from '../src/modules/tracks/tracks.service.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { createTrack, testMbid } from './utils/factories.js';
import { recordingSummary } from './utils/recording-summaries.js';

// Covers the tracks lookup the API enriches catalog hits with: a Recording
// that was processed carries its Track id, any other carries null. The
// table starts empty, so unlinked is the default.
describe('Tracks lookup (e2e)', () => {
  let testApp: TestApp;
  let tracksService: TracksService;

  beforeAll(async () => {
    testApp = await createTestApp();
    tracksService = testApp.app.get(TracksService);
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
  });

  it('returns the Track id when the Recording was processed', async () => {
    const track = await createTrack(testApp.db, {
      recordingMbid: testMbid(1),
    });

    const [item] = await tracksService.attachTrackIds([
      recordingSummary(testMbid(1), 'Linked Song'),
    ]);

    expect(item?.trackId).toBe(track.id);
    expect(searchResultItemSchema.parse(item)).toEqual(item);
  });

  it('returns null when the Recording has no Track yet', async () => {
    const [item] = await tracksService.attachTrackIds([
      recordingSummary(testMbid(1), 'Unprocessed Song'),
    ]);

    expect(item).toMatchObject({ mbid: testMbid(1), trackId: null });
  });

  it('enriches a page of mixed hits in the catalog order', async () => {
    const track = await createTrack(testApp.db, {
      recordingMbid: testMbid(2),
    });

    const items = await tracksService.attachTrackIds([
      recordingSummary(testMbid(1), 'First'),
      recordingSummary(testMbid(2), 'Second'),
    ]);

    expect(items.map((item) => [item.title, item.trackId])).toEqual([
      ['First', null],
      ['Second', track.id],
    ]);
  });

  it('maps a single recording identifier to its Track id', async () => {
    const track = await createTrack(testApp.db, {
      recordingMbid: testMbid(1),
    });

    const trackIds = await tracksService.findTrackIdsByRecordingMbids([
      testMbid(1),
      testMbid(2),
    ]);

    expect(trackIds.get(testMbid(1))).toBe(track.id);
    expect(trackIds.has(testMbid(2))).toBe(false);
  });

  it('looks nothing up for no recording identifiers', async () => {
    await expect(
      tracksService.findTrackIdsByRecordingMbids([]),
    ).resolves.toEqual(new Map());
  });

  it('removes the legacy map entry with its Track', async () => {
    const track = await createTrack(testApp.db, {
      recordingMbid: testMbid(1),
    });
    await testApp.db
      .insert(legacyTrackIds)
      .values({ legacyId: 'legacy-1', trackId: track.id });

    await testApp.db.delete(tracks).where(eq(tracks.id, track.id));

    await expect(testApp.db.select().from(legacyTrackIds)).resolves.toEqual([]);
  });
});
