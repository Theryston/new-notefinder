import { CatalogError } from '../errors/catalog-error.js';
import {
  errorResponse,
  formatIssues,
  okResponse,
  parseRequest,
  toMusicCatalogError,
} from './envelope.js';

describe('parseRequest', () => {
  it('reads a request', () => {
    expect(
      parseRequest('{"id":"r1","type":"status","payload":{"a":1}}'),
    ).toEqual({
      ok: true,
      request: { id: 'r1', type: 'status', payload: { a: 1 } },
    });
  });

  it('accepts a request without a payload', () => {
    const parsed = parseRequest('{"id":"r1","type":"status"}');

    expect(parsed).toEqual({
      ok: true,
      request: { id: 'r1', type: 'status' },
    });
  });

  it('ignores fields it does not know', () => {
    expect(
      parseRequest('{"id":"r1","type":"status","extra":true}'),
    ).toMatchObject({ ok: true, request: { id: 'r1', type: 'status' } });
  });

  it('says the text is not JSON', () => {
    expect(parseRequest('hello')).toEqual({
      ok: false,
      id: null,
      message: 'Message is not valid JSON',
    });
  });

  it.each([
    ['text that is not JSON', 'hello'],
    ['an unterminated object', '{"id":"r1"'],
    ['an empty message', ''],
    ['a JSON string', '"status"'],
    ['a JSON number', '42'],
    ['null', 'null'],
    ['an array', '[{"id":"r1","type":"status"}]'],
  ])('rejects %s without an id to echo', (_label, text) => {
    const parsed = parseRequest(text);

    expect(parsed).toMatchObject({ ok: false, id: null });
    expect(parsed).toHaveProperty('message', expect.any(String));
  });

  it.each([
    ['no type', '{"id":"r1"}'],
    ['an empty type', '{"id":"r1","type":""}'],
    ['a type that is not a string', '{"id":"r1","type":7}'],
  ])('echoes the id when the message has %s', (_label, text) => {
    expect(parseRequest(text)).toMatchObject({ ok: false, id: 'r1' });
  });

  it('names the offending field in the message', () => {
    const parsed = parseRequest('{"id":"r1","type":7}');

    expect(parsed).toMatchObject({ message: expect.stringContaining('type') });
  });

  it.each([
    ['missing', '{"type":"status"}'],
    ['empty', '{"id":"","type":"status"}'],
    ['a number', '{"id":1,"type":"status"}'],
    ['too long', `{"id":"${'x'.repeat(129)}","type":"status"}`],
  ])('has no id to echo when it is %s', (_label, text) => {
    expect(parseRequest(text)).toMatchObject({ ok: false, id: null });
  });

  it('accepts the longest id', () => {
    const id = 'x'.repeat(128);

    expect(parseRequest(`{"id":"${id}","type":"status"}`)).toMatchObject({
      ok: true,
      request: { id },
    });
  });
});

describe('responses', () => {
  it('builds a success response', () => {
    expect(okResponse('r1', { phase: 'ready' })).toEqual({
      id: 'r1',
      ok: true,
      result: { phase: 'ready' },
    });
  });

  it('builds an error response', () => {
    expect(errorResponse('r1', 'UNKNOWN_REQUEST_TYPE', 'nope')).toEqual({
      id: 'r1',
      ok: false,
      error: { code: 'UNKNOWN_REQUEST_TYPE', message: 'nope' },
    });
  });

  it('builds an error response without an id', () => {
    expect(errorResponse(null, 'VALIDATION_FAILED', 'bad')).toEqual({
      id: null,
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: 'bad' },
    });
  });
});

describe('toMusicCatalogError', () => {
  it('keeps the code and message of an expected failure', () => {
    expect(
      toMusicCatalogError(new CatalogError('CATALOG_NOT_READY', 'Not yet')),
    ).toEqual({ code: 'CATALOG_NOT_READY', message: 'Not yet' });
  });

  it.each([
    ['an Error', new Error('connection string postgres://secret@host')],
    ['a string', 'boom'],
    ['undefined', undefined],
  ])(
    'hides what went wrong behind INTERNAL when given %s',
    (_label, thrown) => {
      expect(toMusicCatalogError(thrown)).toEqual({
        code: 'INTERNAL',
        message: 'Internal error',
      });
    },
  );
});

describe('formatIssues', () => {
  it('lists each issue with its path', () => {
    expect(formatIssues([{ path: ['a', 0, 'b'], message: 'bad' }])).toBe(
      'a.0.b: bad',
    );
  });

  it('joins issues and names a root issue "request"', () => {
    expect(
      formatIssues([
        { path: [], message: 'first' },
        { path: ['x'], message: 'second' },
      ]),
    ).toBe('request: first; x: second');
  });
});
