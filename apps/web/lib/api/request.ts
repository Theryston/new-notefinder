import type { z } from 'zod';

import { apiErrorFromResponse, internalApiError } from './api-error';

const apiVersionPrefix = '/v1';

type QueryValue = string | number | boolean | null | undefined;

export type ApiRequestOptions<TSchema extends z.ZodType> = {
  /** Contracts schema the response body is parsed with. */
  schema: TSchema;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Serialized as JSON. */
  body?: unknown;
  /** `null`/`undefined` values are omitted. */
  query?: Record<string, QueryValue>;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

/**
 * Isomorphic core shared by the server and browser clients: builds the
 * versioned URL, sends JSON, and parses both success and error bodies with
 * the contracts schemas. Every failure surfaces as an `ApiError`.
 */
export async function apiRequest<TSchema extends z.ZodType>(
  baseUrl: string,
  path: `/${string}`,
  options: ApiRequestOptions<TSchema>,
  init: RequestInit = {},
): Promise<z.output<TSchema>> {
  // Concatenated rather than resolved so a base URL with a path prefix works.
  const url = new URL(
    `${baseUrl.replace(/\/+$/, '')}${apiVersionPrefix}${path}`,
  );
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers(options.headers);
  headers.set('accept', 'application/json');
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      method: options.method ?? 'GET',
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw internalApiError(`Network error calling ${url.pathname}`, error);
  }

  if (!response.ok) throw await apiErrorFromResponse(response);

  const body: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);
  const parsed = options.schema.safeParse(body);

  if (!parsed.success) {
    throw internalApiError(
      `Response from ${url.pathname} doesn't match its contract`,
      parsed.error,
    );
  }

  return parsed.data;
}
