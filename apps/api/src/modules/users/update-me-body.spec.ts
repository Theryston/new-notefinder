import { updateMeBodySchema } from '@notefinder/contracts';

const name = 'Ada King';

// The multipart text parts arrive as strings; the upload interceptor coerces
// the target part to a number before this schema sees it, so the schema
// itself only ever accepts the preset numbers.
describe('updateMeBodySchema (daily target)', () => {
  it.each([300, 600, 900, 1800])(
    'accepts the %i seconds preset',
    (dailyPracticeTargetSeconds) => {
      const result = updateMeBodySchema.safeParse({
        name,
        dailyPracticeTargetSeconds,
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ dailyPracticeTargetSeconds });
    },
  );

  it('leaves the stored target alone when absent', () => {
    const result = updateMeBodySchema.safeParse({ name });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name });
  });

  it.each([
    ['a non-preset whole number', 301],
    ['zero', 0],
    ['a negative number', -300],
    ['an hour in seconds', 3600],
    ['minutes instead of seconds', 15],
    ['a fractional minute', 300.5],
    ['NaN', Number.NaN],
    ['null', null],
    ['text, which only the interceptor may coerce', '600'],
    ['an empty text part', ''],
  ])('rejects %s with no coercion of its own', (_label, value) => {
    const result = updateMeBodySchema.safeParse({
      name,
      dailyPracticeTargetSeconds: value,
    });

    expect(result.success).toBe(false);
  });
});
