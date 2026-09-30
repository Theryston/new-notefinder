import { z } from 'zod';
import { CatalogError } from '../errors/catalog-error.js';
import { defineHandler } from './handler.js';

const echo = defineHandler({
  type: 'status',
  payload: z.object({ name: z.string() }),
  result: z.object({ greeting: z.string() }),
  run: async ({ name }) => ({ greeting: `hi ${name}` }),
});

describe('defineHandler', () => {
  it('runs with the validated payload and returns the result', async () => {
    await expect(echo.handle({ name: 'Ana' })).resolves.toEqual({
      greeting: 'hi Ana',
    });
  });

  it('exposes the request type it answers', () => {
    expect(echo.type).toBe('status');
  });

  it('refuses an invalid payload as VALIDATION_FAILED, naming the field', async () => {
    const error = await echo.handle({ name: 7 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CatalogError);
    expect(error).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: expect.stringContaining('name'),
    });
  });

  it('does not run when the payload is invalid', async () => {
    const run = vi.fn(async () => ({ greeting: 'x' }));
    const handler = defineHandler({
      type: 'status',
      payload: z.object({ name: z.string() }),
      result: z.object({ greeting: z.string() }),
      run,
    });

    await handler.handle({}).catch(() => undefined);

    expect(run).not.toHaveBeenCalled();
  });

  // A handler without a payload, to feed the result check whatever it likes.
  const returning = (run: () => Promise<unknown>) =>
    defineHandler({
      type: 'status',
      payload: z.undefined(),
      result: z.object({ phase: z.string() }),
      run: run as () => Promise<{ phase: string }>,
    });

  it('drops result fields the contract does not declare', async () => {
    const handler = returning(async () => ({ phase: 'ready', secret: 'x' }));

    await expect(handler.handle(undefined)).resolves.toEqual({
      phase: 'ready',
    });
  });

  it('fails as an unexpected error when the result breaks the contract', async () => {
    const handler = returning(async () => ({ phase: 1 }));

    const error = await handler.handle(undefined).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(CatalogError);
  });

  it('lets an expected failure of the service through', async () => {
    const handler = defineHandler({
      type: 'status',
      payload: z.undefined(),
      result: z.object({}),
      run: async () => {
        throw new CatalogError('CATALOG_NOT_READY', 'Not yet');
      },
    });

    await expect(handler.handle(undefined)).rejects.toMatchObject({
      code: 'CATALOG_NOT_READY',
    });
  });
});
