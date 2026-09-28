import { signUpBodySchema } from '@notefinder/contracts';
import type { ResolverOptions } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { lazyResolver } from './lazy-resolver';

const options: ResolverOptions<{
  name: string;
  email: string;
  password: string;
}> = {
  fields: {},
  shouldUseNativeValidation: false,
};

describe('lazyResolver', () => {
  const resolver = lazyResolver(async () => signUpBodySchema);

  it('returns the parsed values when valid', async () => {
    const values = {
      name: ' Ada ',
      email: 'ada@example.com',
      password: '123456',
    };
    await expect(resolver(values, undefined, options)).resolves.toEqual({
      values: { name: 'Ada', email: 'ada@example.com', password: '123456' },
      errors: {},
    });
  });

  it('reports each invalid field with the Zod issue code', async () => {
    const result = await resolver(
      { name: '', email: 'nope', password: '1' },
      undefined,
      options,
    );
    expect(result.values).toEqual({});
    expect(result.errors).toMatchObject({
      name: { type: 'too_small' },
      email: { type: 'invalid_format' },
      password: { type: 'too_small' },
    });
  });

  it('loads the schema once', async () => {
    const load = vi.fn(async () => signUpBodySchema);
    const cached = lazyResolver(load);

    await cached.preload();
    await cached.preload();
    await cached(
      { name: 'Ada', email: 'a@b.co', password: '123456' },
      undefined,
      options,
    );

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed load', async () => {
    const load = vi
      .fn<() => Promise<typeof signUpBodySchema>>()
      .mockRejectedValueOnce(new Error('ChunkLoadError'))
      .mockResolvedValue(signUpBodySchema);
    const retrying = lazyResolver(load);

    await expect(retrying.preload()).rejects.toThrow('ChunkLoadError');
    await expect(retrying.preload()).resolves.toBeTypeOf('function');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
