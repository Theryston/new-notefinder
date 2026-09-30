import {
  type MusicCatalogErrorResponse,
  musicCatalogErrorResponseSchema,
  musicCatalogStatusResponseSchema,
} from '@notefinder/contracts';
import {
  API_KEY,
  ROTATED_API_KEY,
  useTestServer,
} from './utils/create-test-server.js';
import { setBootstrapState } from './utils/database.js';
import { useTestClient } from './utils/use-test-client.js';
import { connect, type TestClient } from './utils/ws-client.js';

describe('protocol (e2e)', () => {
  const server = useTestServer();
  const client = useTestClient(server);

  const expectStillServing = async (who: TestClient = client()) => {
    expect(who.isOpen).toBe(true);
    await expect(who.request('status', {})).resolves.toMatchObject({
      ok: true,
    });
  };

  const parseError = (response: unknown): MusicCatalogErrorResponse =>
    musicCatalogErrorResponseSchema.parse(response);

  describe('malformed messages', () => {
    it.each([
      ['text that is not JSON', 'hello there'],
      ['an unterminated object', '{"id":"x","type":"status"'],
      ['a JSON array', '[1,2,3]'],
      ['JSON null', 'null'],
    ])('answers VALIDATION_FAILED for %s, without an id', async (_l, text) => {
      const answer = client().responseFor('null');
      client().sendRaw(text);

      expect(parseError(await answer)).toEqual({
        id: null,
        ok: false,
        error: { code: 'VALIDATION_FAILED', message: expect.any(String) },
      });
      await expectStillServing();
    });

    it('answers VALIDATION_FAILED with the request id when only the type is missing', async () => {
      const answer = client().responseFor('req-7');
      client().send({ id: 'req-7' });

      expect(parseError(await answer)).toMatchObject({
        id: 'req-7',
        error: {
          code: 'VALIDATION_FAILED',
          message: expect.stringContaining('type'),
        },
      });
      await expectStillServing();
    });

    it('refuses a binary frame, keeping the connection open', async () => {
      const answer = client().responseFor('null');
      client().sendRaw(Buffer.from('{"id":"b","type":"status"}'), {
        binary: true,
      });

      expect(parseError(await answer).error.code).toBe('VALIDATION_FAILED');
      await expectStillServing();
    });

    it('closes the connection of a message over the size limit, only that one', async () => {
      const other = await connect(server().url, API_KEY);
      const closed = client().closed;

      client().send({
        id: 'big',
        type: 'status',
        payload: 'x'.repeat(100_000),
      });

      await expect(closed).resolves.toEqual({ code: 1009 });
      await expectStillServing(other);
      await other.close();
    });
  });

  describe('unknown request types', () => {
    it('answers UNKNOWN_REQUEST_TYPE with the request id', async () => {
      const response = parseError(
        await client().request('teleport', {}, 'req-1'),
      );

      expect(response).toEqual({
        id: 'req-1',
        ok: false,
        error: {
          code: 'UNKNOWN_REQUEST_TYPE',
          message: expect.stringContaining('teleport'),
        },
      });
      await expectStillServing();
    });
  });

  describe('correlation', () => {
    it('answers many requests in flight with their own ids', async () => {
      await setBootstrapState(server().db, { phase: 'ready', dataset: 'full' });
      const kinds = ['status', 'unknown', 'invalid'] as const;
      const requests = Array.from({ length: 150 }, (_, index) => ({
        id: `req-${index}`,
        kind: kinds[index % kinds.length] ?? 'status',
      }));

      const responses = await Promise.all(
        requests.map(({ id, kind }) =>
          client().request(
            kind === 'unknown' ? 'teleport' : 'status',
            kind === 'invalid' ? 'not an object' : {},
            id,
          ),
        ),
      );

      responses.forEach((response, index) => {
        const request = requests[index];
        expect(response).toMatchObject({ id: request?.id });
        if (request?.kind === 'status') {
          expect(
            musicCatalogStatusResponseSchema.parse(response),
          ).toMatchObject({
            ok: true,
            result: { phase: 'ready', dataset: 'full' },
          });
        } else {
          expect(parseError(response).error.code).toBe(
            request?.kind === 'unknown'
              ? 'UNKNOWN_REQUEST_TYPE'
              : 'VALIDATION_FAILED',
          );
        }
      });
    });
  });

  describe('several connections', () => {
    it('serves them at the same time, each with its own responses', async () => {
      const others = await Promise.all([
        connect(server().url, API_KEY),
        connect(server().url, ROTATED_API_KEY),
        connect(server().url, API_KEY),
      ]);

      const responses = await Promise.all(
        [client(), ...others].map((who, index) =>
          who.request('status', {}, `conn-${index}`),
        ),
      );

      expect(responses.map((r) => (r as { id: string }).id)).toEqual([
        'conn-0',
        'conn-1',
        'conn-2',
        'conn-3',
      ]);
      await Promise.all(others.map((who) => who.close()));
    });

    it('keeps serving the others when one connection closes', async () => {
      const leaving = await connect(server().url, API_KEY);

      await leaving.close();

      await expectStillServing();
    });
  });
});
