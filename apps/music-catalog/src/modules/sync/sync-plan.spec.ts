import type { RecordingDocument } from '../../lib/recordings-index.js';
import {
  type CurrentRecording,
  type OutboxEntry,
  planSync,
} from './sync-plan.js';

const document = (mbid: string): RecordingDocument => ({
  mbid,
  title: `Title of ${mbid}`,
  artistCredit: 'Artist',
  artistAliases: ['Artist'],
  releaseTitles: [],
  workTitles: [],
  genres: [],
  disambiguation: '',
});

const entry = (recordingId: number, recordingMbid: string): OutboxEntry => ({
  recordingId,
  recordingMbid,
  enqueuedAt: new Date('2026-01-01T00:00:00Z'),
});

const current = (id: number, mbid: string): [number, CurrentRecording] => [
  id,
  { mbid, document: document(mbid) },
];

describe('planSync', () => {
  it('plans nothing for no entries', () => {
    expect(planSync([], new Map())).toEqual({ upserts: [], deletes: [] });
  });

  it('reindexes a Recording that still exists, deleting nothing', () => {
    const plan = planSync(
      [entry(7, 'mbid-7')],
      new Map([current(7, 'mbid-7')]),
    );

    expect(plan.upserts.map((doc) => doc.mbid)).toEqual(['mbid-7']);
    expect(plan.deletes).toEqual([]);
  });

  it('deletes the MBID of a Recording whose row is gone', () => {
    const plan = planSync([entry(7, 'mbid-gone')], new Map());

    expect(plan.upserts).toEqual([]);
    expect(plan.deletes).toEqual(['mbid-gone']);
  });

  it('reindexes under the new MBID and deletes the stale one after a merge or an MBID change', () => {
    const plan = planSync(
      [entry(7, 'mbid-old'), entry(9, 'mbid-survivor')],
      new Map([current(9, 'mbid-survivor')]),
    );

    expect(plan.upserts.map((doc) => doc.mbid)).toEqual(['mbid-survivor']);
    expect(plan.deletes).toEqual(['mbid-old']);
  });

  it('deletes each stale MBID once, however many entries name it', () => {
    const plan = planSync(
      [entry(7, 'mbid-old'), entry(7, 'mbid-old'), entry(8, 'mbid-old')],
      new Map([current(8, 'mbid-new')]),
    );

    expect(plan.upserts.map((doc) => doc.mbid)).toEqual(['mbid-new']);
    expect(plan.deletes).toEqual(['mbid-old']);
  });
});
