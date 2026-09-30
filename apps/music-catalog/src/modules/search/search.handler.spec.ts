import { createSearchHandler } from './search.handler.js';
import type { SearchService } from './search.service.js';

const setup = () => {
  const service = { search: vi.fn(async () => ({ results: [] })) };
  const handler = createSearchHandler(service as unknown as SearchService);
  return { handler, service };
};

describe('createSearchHandler', () => {
  it('answers the search request type', () => {
    expect(setup().handler.type).toBe('search');
  });

  it('gives the service the payload with its defaults applied', async () => {
    const { handler, service } = setup();

    await handler.handle({ query: 'yesterday' });

    expect(service.search).toHaveBeenCalledExactlyOnceWith({
      query: 'yesterday',
      scope: 'metadata',
      limit: 20,
      offset: 0,
    });
  });

  it('gives the service what the client chose', async () => {
    const { handler, service } = setup();

    await handler.handle({
      query: 'yesterday',
      scope: 'lyrics',
      limit: 100,
      offset: 900,
    });

    expect(service.search).toHaveBeenCalledExactlyOnceWith({
      query: 'yesterday',
      scope: 'lyrics',
      limit: 100,
      offset: 900,
    });
  });

  it('trims the query before the service sees it', async () => {
    const { handler, service } = setup();

    await handler.handle({ query: '  the sound of silence \n' });

    expect(service.search).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'the sound of silence' }),
    );
  });

  it.each([
    ['no payload', undefined],
    ['an empty payload', {}],
    ['an empty query', { query: '' }],
    ['a query of blanks', { query: '  \t ' }],
    ['a query that is not text', { query: 7 }],
    ['a query of 257 characters', { query: 'a'.repeat(257) }],
    ['an unknown scope', { query: 'x', scope: 'all' }],
    ['a limit of 0', { query: 'x', limit: 0 }],
    ['a limit of 101', { query: 'x', limit: 101 }],
    ['a fractional limit', { query: 'x', limit: 1.5 }],
    ['a limit that is text', { query: 'x', limit: '10' }],
    ['a negative offset', { query: 'x', offset: -1 }],
    ['an offset of 901', { query: 'x', offset: 901 }],
    ['a fractional offset', { query: 'x', offset: 0.5 }],
  ])('refuses %s before reaching the service', async (_label, payload) => {
    const { handler, service } = setup();

    await expect(handler.handle(payload)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(service.search).not.toHaveBeenCalled();
  });

  it('accepts the edges of every bound', async () => {
    const { handler } = setup();

    await expect(
      handler.handle({ query: 'a'.repeat(256), limit: 1, offset: 0 }),
    ).resolves.toEqual({ results: [] });
    await expect(
      handler.handle({ query: 'x', limit: 100, offset: 900 }),
    ).resolves.toEqual({ results: [] });
  });

  it('answers the contract and nothing more: a field it does not declare is cut off', async () => {
    const { handler, service } = setup();
    const extra = { results: [], estimatedTotalHits: 10 };
    service.search.mockResolvedValueOnce(extra as never);

    const answer = await handler.handle({ query: 'x' });

    expect(answer).toStrictEqual({ results: [] });
  });
});
