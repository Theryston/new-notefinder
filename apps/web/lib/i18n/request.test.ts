import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localeHeaderName } from './locale-header';
import resolveRequestConfig from './request';
import type { Locale } from './routing';

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  rootLocale: vi.fn(),
}));

vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/root-params', () => ({ locale: mocks.rootLocale }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
// On the server `getRequestConfig` returns its argument unchanged; the
// client build the test runner loads would throw instead.
vi.mock('next-intl/server', () => ({
  getRequestConfig: (createRequestConfig: unknown) => createRequestConfig,
}));

const forwardedLocale = (value: string | undefined) =>
  mocks.headers.mockResolvedValue(
    new Headers(value === undefined ? {} : { [localeHeaderName]: value }),
  );

/** Resolves the request config for a call with an optional explicit locale. */
const resolve = (locale?: Locale) =>
  resolveRequestConfig({
    locale,
    requestLocale: Promise.resolve(undefined),
  });

beforeEach(() => {
  mocks.rootLocale.mockResolvedValue(undefined);
  forwardedLocale(undefined);
});

describe('request locale resolution', () => {
  it('uses the explicit override without reading the request', async () => {
    const config = await resolve('pt-BR');

    expect(config.locale).toBe('pt-BR');
    expect(mocks.headers).not.toHaveBeenCalled();
  });

  it('uses the [locale] segment of a page under the locale tree', async () => {
    mocks.rootLocale.mockResolvedValue('pt-BR');

    const config = await resolve();

    expect(config.locale).toBe('pt-BR');
    expect(mocks.headers).not.toHaveBeenCalled();
  });

  it('uses the locale the proxy forwarded outside the locale tree', async () => {
    forwardedLocale('pt-BR');

    const config = await resolve();

    expect(config.locale).toBe('pt-BR');
  });

  it('falls back to en when no locale header was forwarded', async () => {
    forwardedLocale(undefined);

    const config = await resolve();

    expect(config.locale).toBe('en');
  });

  it('falls back to en when the forwarded locale is not supported', async () => {
    forwardedLocale('fr');

    const config = await resolve();

    expect(config.locale).toBe('en');
  });

  it('loads the catalog of the resolved locale', async () => {
    forwardedLocale('pt-BR');

    const config = await resolve();

    expect(config.messages).toMatchObject({
      notFound: { title: 'Página não encontrada' },
    });
  });
});
