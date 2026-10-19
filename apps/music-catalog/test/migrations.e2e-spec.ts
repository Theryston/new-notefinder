import { sql } from 'drizzle-orm';
import { useTestServer } from './utils/create-test-server.js';

// The global setup migrates the test database with the real migrations, so
// this reads what they leave behind: the LRCLIB tables are dropped, and the
// catalog's own tables survive.
describe('migrations: the LRCLIB tables are dropped', () => {
  const server = useTestServer();

  it('drops the kept-Lyrics and the LRCLIB refresh tables', async () => {
    const rows = await server().db.execute<{ table_name: string }>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'music_catalog'
    `);
    const tables = rows.rows.map((row) => row.table_name);

    expect(tables).toContain('bootstrap_state');
    expect(tables).not.toContain('recording_lyrics');
    expect(tables).not.toContain('lrclib_refresh_state');
  });
});
