import {
  type MusicCatalogError,
  type MusicCatalogErrorCode,
  type MusicCatalogErrorResponse,
  type MusicCatalogRequest,
  type MusicCatalogSuccessResponse,
  musicCatalogRequestIdSchema,
  musicCatalogRequestSchema,
} from '@notefinder/contracts';
import { CatalogError } from '../errors/catalog-error.js';

export type ParsedRequest =
  | { ok: true; request: MusicCatalogRequest }
  // `id` is null when the message was too broken to read one from it.
  | { ok: false; id: string | null; message: string };

type Issue = { path: readonly PropertyKey[]; message: string };

/** One line for a developer: `path: problem; other.path: problem`. */
export const formatIssues = (issues: readonly Issue[]): string =>
  issues
    .map((issue) => {
      const path = issue.path.map(String).join('.');
      return `${path === '' ? 'request' : path}: ${issue.message}`;
    })
    .join('; ');

// The id of a message that failed validation, so the client can still tell
// which of its requests was refused.
const readableId = (json: unknown): string | null => {
  if (typeof json !== 'object' || json === null) {
    return null;
  }
  const id = musicCatalogRequestIdSchema.safeParse(
    (json as { id?: unknown }).id,
  );
  return id.success ? id.data : null;
};

const parseJson = (text: string): { value: unknown } | undefined => {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return undefined;
  }
};

/** Reads a text frame as a request envelope; it never throws. */
export const parseRequest = (text: string): ParsedRequest => {
  const json = parseJson(text);
  if (json === undefined) {
    return { ok: false, id: null, message: 'Message is not valid JSON' };
  }
  const result = musicCatalogRequestSchema.safeParse(json.value);
  if (!result.success) {
    return {
      ok: false,
      id: readableId(json.value),
      message: formatIssues(result.error.issues),
    };
  }
  return { ok: true, request: result.data };
};

export const okResponse = <TResult>(
  id: string,
  result: TResult,
): MusicCatalogSuccessResponse<TResult> => ({ id, ok: true, result });

export const errorResponse = (
  id: string | null,
  code: MusicCatalogErrorCode,
  message: string,
  extra: Omit<MusicCatalogError, 'code' | 'message'> = {},
): MusicCatalogErrorResponse => ({
  id,
  ok: false,
  error: { code, message, ...extra },
});

/**
 * What a client is told about a thrown value: an expected failure keeps its
 * code and message; anything else is `INTERNAL` with no detail, since the
 * message of an unexpected error may carry connection strings or SQL.
 */
export const toMusicCatalogError = (error: unknown): MusicCatalogError => {
  if (!(error instanceof CatalogError)) {
    return { code: 'INTERNAL', message: 'Internal error' };
  }
  const { code, message, newMbid } = error;
  return newMbid === undefined ? { code, message } : { code, message, newMbid };
};
