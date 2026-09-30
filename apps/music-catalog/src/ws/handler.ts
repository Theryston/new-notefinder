import type { MusicCatalogRequestType } from '@notefinder/contracts';
import type { z } from 'zod';
import { CatalogError } from '../errors/catalog-error.js';
import { formatIssues } from './envelope.js';

/** Answers every request of one type; see {@link defineHandler}. */
export type Handler = {
  readonly type: MusicCatalogRequestType;
  readonly handle: (payload: unknown) => Promise<unknown>;
};

type HandlerSpec<TPayload extends z.ZodType, TResult extends z.ZodType> = {
  type: MusicCatalogRequestType;
  payload: TPayload;
  result: TResult;
  run: (payload: z.output<TPayload>) => Promise<z.input<TResult>>;
};

/**
 * Ties a request type to its contract: the payload is validated before `run`
 * sees it (a bad one is `VALIDATION_FAILED`), and the result is parsed with
 * the contract's result schema, so a field the schema doesn't declare never
 * reaches the client. Both schemas come from `@notefinder/contracts`.
 */
export const defineHandler = <
  TPayload extends z.ZodType,
  TResult extends z.ZodType,
>(
  spec: HandlerSpec<TPayload, TResult>,
): Handler => ({
  type: spec.type,
  handle: async (rawPayload) => {
    const payload = spec.payload.safeParse(rawPayload);
    if (!payload.success) {
      throw new CatalogError(
        'VALIDATION_FAILED',
        formatIssues(payload.error.issues),
      );
    }
    return spec.result.parse(await spec.run(payload.data));
  },
});
