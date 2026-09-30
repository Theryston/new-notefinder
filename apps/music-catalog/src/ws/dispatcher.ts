import type { MusicCatalogResponse } from '@notefinder/contracts';
import { CatalogError } from '../errors/catalog-error.js';
import type { Logger } from '../logger.js';
import {
  errorResponse,
  okResponse,
  parseRequest,
  toMusicCatalogError,
} from './envelope.js';
import type { Handler } from './handler.js';

export type DispatcherOptions = {
  handlers: readonly Handler[];
  /** A handler still running after this long is answered with INTERNAL. */
  requestTimeoutMs: number;
  logger: Logger;
};

type RequestInfo = { id: string; type: string };

class RequestTimeoutError extends CatalogError {
  constructor() {
    super('INTERNAL', 'Request timed out');
  }
}

// The handler keeps running after a timeout (a promise can't be cancelled),
// but the client stops waiting for it.
const withTimeout = async <T>(
  work: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new RequestTimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([work, timedOut]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Turns one text frame into its response: parse the envelope, find the
 * handler by `type`, run it under the request timeout and map whatever it
 * throws. It never rejects, so one bad request can't break the others in
 * flight, and every message gets exactly one response.
 */
export const createDispatcher = (
  options: DispatcherOptions,
): ((text: string) => Promise<MusicCatalogResponse>) => {
  const handlers = new Map<string, Handler>(
    options.handlers.map((handler) => [handler.type, handler]),
  );

  const fail = (info: RequestInfo, error: unknown): MusicCatalogResponse => {
    const body = toMusicCatalogError(error);
    if (error instanceof RequestTimeoutError) {
      options.logger.warn(error.message, {
        ...info,
        timeoutMs: options.requestTimeoutMs,
      });
    } else if (body.code === 'INTERNAL') {
      options.logger.error('Request failed', { ...info, error });
    }
    return errorResponse(info.id, body.code, body.message);
  };

  return async (text) => {
    const parsed = parseRequest(text);
    if (!parsed.ok) {
      return errorResponse(parsed.id, 'VALIDATION_FAILED', parsed.message);
    }
    const { id, type, payload } = parsed.request;
    const handler = handlers.get(type);
    if (handler === undefined) {
      return errorResponse(
        id,
        'UNKNOWN_REQUEST_TYPE',
        `Unknown request type "${type}"`,
      );
    }
    try {
      const result = await withTimeout(
        handler.handle(payload),
        options.requestTimeoutMs,
      );
      return okResponse(id, result);
    } catch (error) {
      return fail({ id, type }, error);
    }
  };
};
