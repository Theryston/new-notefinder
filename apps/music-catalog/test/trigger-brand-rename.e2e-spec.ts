import { sql } from 'drizzle-orm';
import type { Database } from '../src/database/database.js';
import { RecordingOutboxRepository } from '../src/modules/sync/recording-outbox.repository.js';
import { useTestServer } from './utils/create-test-server.js';
import { addRecording, renameRecording } from './utils/musicbrainz.js';
import { requestSearch } from './utils/search-client.js';
import {
  createTestWorker,
  indexCatalog,
  useEmptySearchIndex,
} from './utils/test-worker.js';
import { useTestClient } from './utils/use-test-client.js';

const recordingTriggers = async (db: Database) => {
  const result = await db.execute<{ name: string; id: string }>(sql`
    select t.tgname as "name", t.oid::text as "id"
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'musicbrainz' and c.relname = 'recording'
      and not t.tgisinternal
    order by t.tgname
  `);
  return result.rows;
};

describe('sync trigger names after a product rename (e2e)', () => {
  const server = useTestServer();
  const client = useTestClient(server);

  useEmptySearchIndex();

  it('replaces old trigger names once and keeps recording changes searchable', async () => {
    const db = server().db;
    const recording = await addRecording(db, { name: 'Before the rename' });
    await indexCatalog(server());
    await db.execute(sql`
      alter trigger vozzify_sync_recording on musicbrainz.recording
      rename to notefinder_sync_recording
    `);

    const repository = new RecordingOutboxRepository(db);
    await repository.ensureTriggers();
    const migrated = await recordingTriggers(db);
    expect(migrated.map((trigger) => trigger.name)).toContain(
      'vozzify_sync_recording',
    );
    expect(migrated.map((trigger) => trigger.name)).not.toContain(
      'notefinder_sync_recording',
    );
    expect(
      migrated.filter((trigger) => trigger.name === 'vozzify_sync_recording'),
    ).toHaveLength(1);

    await repository.ensureTriggers();
    expect(await recordingTriggers(db)).toEqual(migrated);

    await renameRecording(db, recording, 'Vozzify Migration Ballad');
    await createTestWorker(server()).tick();
    const response = await requestSearch(client(), {
      query: 'Vozzify Migration Ballad',
    });
    expect(response).toMatchObject({
      ok: true,
      result: {
        results: [{ mbid: recording.mbid }],
      },
    });
  });

  it('preserves unrelated functions and triggers with similar names', async () => {
    const db = server().db;
    await db.execute(sql`
      create function musicbrainz.sync_outbox_from_external() returns trigger
        language plpgsql as $fn$ begin return new; end; $fn$;
      create function music_catalog.syncXoutboxXfrom_external() returns trigger
        language plpgsql as $fn$ begin return new; end; $fn$;
      create trigger external_sync_namespace after insert on musicbrainz.recording
        for each row execute function musicbrainz.sync_outbox_from_external();
      create trigger external_sync_pattern after insert on musicbrainz.recording
        for each row execute function music_catalog.syncXoutboxXfrom_external();
    `);
    try {
      await new RecordingOutboxRepository(db).ensureTriggers();
      const names = (await recordingTriggers(db)).map(
        (trigger) => trigger.name,
      );
      expect(names).toContain('external_sync_namespace');
      expect(names).toContain('external_sync_pattern');
    } finally {
      await db.execute(sql`
        drop trigger external_sync_namespace on musicbrainz.recording;
        drop trigger external_sync_pattern on musicbrainz.recording;
        drop function musicbrainz.sync_outbox_from_external();
        drop function music_catalog.syncXoutboxXfrom_external();
      `);
    }
  });
});
