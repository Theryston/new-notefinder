import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseEnv } from './parse-env';

const schema = z.object({
  API_URL: z.url(),
  SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3000),
});

describe('parseEnv', () => {
  it('returns the parsed values', () => {
    expect(
      parseEnv('server', schema, {
        API_URL: 'http://localhost:3333',
        SECRET: 'x'.repeat(32),
      }),
    ).toEqual({
      API_URL: 'http://localhost:3333',
      SECRET: 'x'.repeat(32),
      PORT: 3000,
    });
  });

  it('throws one error listing every invalid variable', () => {
    const parse = () =>
      parseEnv('server', schema, { API_URL: 'not a url', SECRET: 'short' });

    expect(parse).toThrow(/^Invalid server environment variables:\n/);
    expect(parse).toThrow(/\n {2}- API_URL: .+/);
    expect(parse).toThrow(/\n {2}- SECRET: .+/);
    expect(parse).toThrow(/See apps\/web\/\.env\.example/);
  });

  it('reports missing variables by name', () => {
    expect(() => parseEnv('public', schema, {})).toThrow(
      /Invalid public environment variables:\n {2}- API_URL: .+\n {2}- SECRET: .+/,
    );
  });

  it('labels root-level issues', () => {
    const rootSchema = z
      .object({ A: z.string().optional(), B: z.string().optional() })
      .refine((env) => env.A || env.B, 'A or B is required');

    expect(() => parseEnv('server', rootSchema, {})).toThrow(
      '  - (root): A or B is required',
    );
  });
});
