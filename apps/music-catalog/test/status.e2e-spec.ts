import {
  type MusicCatalogStatusResponse,
  musicCatalogErrorResponseSchema,
  musicCatalogStatusResponseSchema,
} from '@notefinder/contracts';
import { useTestServer } from './utils/create-test-server.js';
import { setBootstrapState } from './utils/database.js';
import { useTestClient } from './utils/use-test-client.js';

describe('status (e2e)', () => {
  const server = useTestServer();
  const client = useTestClient(server);

  const status = async (
    payload?: unknown,
  ): Promise<MusicCatalogStatusResponse> =>
    musicCatalogStatusResponseSchema.parse(
      await client().request('status', payload),
    );

  it('answers the configured dataset as restoring before the import records anything', async () => {
    const response = await status({});

    expect(response).toMatchObject({
      ok: true,
      result: { phase: 'restoring', dataset: 'tiny' },
    });
  });

  it.each([
    ['restoring', 'tiny'],
    ['restored', 'tiny'],
    ['indexing', 'full'],
    ['ready', 'full'],
  ] as const)(
    'reports the recorded phase %s of the %s dataset',
    async (phase, dataset) => {
      await setBootstrapState(server().db, { phase, dataset });

      const response = await status({});

      expect(response).toMatchObject({ ok: true, result: { phase, dataset } });
    },
  );

  it('echoes the id of the request', async () => {
    const response = await client().request('status', {}, 'my-request-id');

    expect(response).toMatchObject({ id: 'my-request-id', ok: true });
  });

  it('follows the import as it advances, on the same connection', async () => {
    await setBootstrapState(server().db, {
      phase: 'restoring',
      dataset: 'tiny',
    });
    const phases = [await status({})];

    for (const phase of ['restored', 'indexing', 'ready'] as const) {
      await setBootstrapState(server().db, { phase, dataset: 'tiny' });
      phases.push(await status({}));
    }

    expect(phases.map((r) => r.ok && r.result.phase)).toEqual([
      'restoring',
      'restored',
      'indexing',
      'ready',
    ]);
  });

  it('accepts a request without a payload', async () => {
    const response = await status(undefined);

    expect(response).toMatchObject({ ok: true });
  });

  it('refuses a payload that is not an object, keeping the connection open', async () => {
    const response = musicCatalogErrorResponseSchema.parse(
      await client().request('status', 'please'),
    );

    expect(response.error.code).toBe('VALIDATION_FAILED');
    expect(client().isOpen).toBe(true);
    await expect(status({})).resolves.toMatchObject({ ok: true });
  });
});
