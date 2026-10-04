import type { Logger } from '../../logger.js';
import type {
  KeptLyricsRow,
  LyricsInsert,
  LyricsRepository,
  MatchingRecording,
} from './lyrics.repository.js';
import { LyricsCarryoverService } from './lyrics-carryover.service.js';

const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const keptRow = (mbid: string): KeptLyricsRow => ({
  mbid,
  plain: `plain ${mbid}`,
  synced: null,
});

const matchable = (mbid: string): MatchingRecording => ({
  id: 1,
  mbid,
  title: 'Carried Song',
  lengthMs: 180_000,
  artistCredit: 'Carried Singer',
  artistNames: ['Carried Singer'],
  albumTitles: ['Carried Album'],
});

const setup = (
  options: {
    batches?: KeptLyricsRow[][];
    sourceRecordings?: Map<string, MatchingRecording>;
    targetRecordings?: Map<string, MatchingRecording>;
  } = {},
) => {
  const batches = options.batches ?? [
    [keptRow('mbid-1'), keptRow('mbid-2')],
    [],
  ];
  const kept = batches.flat();
  const saved: LyricsInsert[] = [];
  const deleted: string[][] = [];
  const sourceRecordings =
    options.sourceRecordings ??
    new Map(kept.map((row) => [row.mbid, matchable(row.mbid)]));
  const targetRecordings =
    options.targetRecordings ??
    new Map(kept.map((row) => [row.mbid, matchable(row.mbid)]));
  const byMbids =
    (recordings: Map<string, MatchingRecording>) =>
    async (mbids: readonly string[]) =>
      mbids.flatMap((mbid) => {
        const row = recordings.get(mbid);
        return row === undefined ? [] : [row];
      });
  const source = {
    findKeptBatch: vi.fn(async () => batches.shift() ?? []),
    findMatchRecordingsByMbids: vi.fn(byMbids(sourceRecordings)),
  };
  const target = {
    findMatchRecordingsByMbids: vi.fn(byMbids(targetRecordings)),
    saveLyrics: vi.fn(async (rows: readonly LyricsInsert[]) => {
      saved.push(...rows);
    }),
    deleteKeptByMbids: vi.fn(async (mbids: readonly string[]) => {
      deleted.push([...mbids]);
    }),
  };
  const service = new LyricsCarryoverService({
    source: source as unknown as LyricsRepository,
    target: target as unknown as LyricsRepository,
    batchSize: 100,
    logger: silentLogger,
  });
  return { service, source, target, saved, deleted };
};

describe('LyricsCarryoverService', () => {
  it('carries kept Lyrics whose take is unchanged onto the new copy', async () => {
    const { service, saved, deleted } = setup();

    await expect(
      service.carryOver(new AbortController().signal),
    ).resolves.toEqual({ carried: 2, dropped: 0 });

    expect(saved.map((row) => row.mbid).sort()).toEqual(['mbid-1', 'mbid-2']);
    expect(deleted).toEqual([[]]);
  });

  it('drops Lyrics whose Recording changed or vanished', async () => {
    const targetRecordings = new Map([
      ['mbid-1', { ...matchable('mbid-1'), title: 'Carried Song (Live)' }],
    ]);
    const { service, saved, deleted } = setup({ targetRecordings });

    await expect(service.carryOver()).resolves.toEqual({
      carried: 0,
      dropped: 2,
    });

    expect(saved).toHaveLength(0);
    expect(deleted).toEqual([['mbid-1', 'mbid-2']]);
  });

  it('walks every kept batch until none is left', async () => {
    const { service, source, saved } = setup({
      batches: [[keptRow('mbid-1')], [keptRow('mbid-2')], []],
    });

    await expect(service.carryOver()).resolves.toEqual({
      carried: 2,
      dropped: 0,
    });

    expect(source.findKeptBatch).toHaveBeenCalledTimes(3);
    expect(saved).toHaveLength(2);
  });

  it('stops after the batch in progress when aborted', async () => {
    const { service, source } = setup();
    const controller = new AbortController();
    controller.abort();

    await expect(service.carryOver(controller.signal)).resolves.toEqual({
      carried: 0,
      dropped: 0,
    });

    expect(source.findKeptBatch).not.toHaveBeenCalled();
  });
});
