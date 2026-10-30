import { parseEnv } from '../../config/env.js';
import { PriceNoticeReconciliation } from './price-notice-reconciliation.js';

const env = parseEnv({
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  RESEND_API_KEY: 're_test',
  EMAIL_FROM: 'vozzify <noreply@vozzify.com>',
});
const input = {
  id: 'change-1',
  attempt: 0,
  cursor: null,
  startedAt: new Date('2026-01-01T00:00:00Z'),
  message: {
    to: 'singer@example.com',
    subject: 'Price',
    html: '<p>Price</p>',
    text: 'Price',
  },
};

function matchingRecord(tag: string) {
  return vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        has_more: false,
        data: [
          {
            id: 'mail',
            to: ['singer@example.com'],
            subject: 'Price',
            created_at: '2026-01-01T00:00:01Z',
          },
        ],
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        id: 'mail',
        to: ['singer@example.com'],
        subject: 'Price',
        html: '<p>Price</p>',
        text: 'Price',
        last_event: 'delivered',
        tags: [{ name: 'price_notice', value: tag }],
      }),
    );
}

describe('uncertain price-notice reconciliation', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('recognizes only the provider record with the matching notice identity and content', async () => {
    const fetchMock = matchingRecord('change-1-0');
    vi.stubGlobal('fetch', fetchMock);
    expect(await new PriceNoticeReconciliation(env).find(input)).toMatchObject({
      found: true,
    });
  });
  it('does not treat a missing or unmatched record as successful notice', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ has_more: false, data: [] })),
    );
    expect(await new PriceNoticeReconciliation(env).find(input)).toEqual({
      found: false,
      cursor: null,
    });
  });

  it('rejects a matching message with another notice tag', async () => {
    const fetchMock = matchingRecord('another-notice');
    vi.stubGlobal('fetch', fetchMock);
    expect(await new PriceNoticeReconciliation(env).find(input)).toEqual({
      found: false,
      cursor: null,
    });
  });
  it('advances the cursor through newer records and stops after the notice window', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          has_more: true,
          data: [
            {
              id: 'newer',
              to: ['someone@example.com'],
              subject: 'Other',
              created_at: '2026-02-01T00:00:00Z',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          has_more: true,
          data: [
            {
              id: 'older',
              to: ['someone@example.com'],
              subject: 'Other',
              created_at: '2025-01-01T00:00:00Z',
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const service = new PriceNoticeReconciliation(env);
    expect(await service.find(input)).toEqual({
      found: false,
      cursor: 'newer',
    });
    expect(await service.find({ ...input, cursor: 'newer' })).toEqual({
      found: false,
      cursor: null,
    });
  });
});
