import type { MusicCatalogErrorCode } from '@notefinder/contracts';

/**
 * An expected failure a client can act on. Throw it from a service or a
 * handler; the WebSocket layer answers it as an error response with the same
 * `code`. Anything else that is thrown is an `INTERNAL` error whose message is
 * never sent to the client.
 */
export class CatalogError extends Error {
  readonly code: MusicCatalogErrorCode;

  constructor(code: MusicCatalogErrorCode, message: string) {
    super(message);
    this.name = 'CatalogError';
    this.code = code;
  }
}
