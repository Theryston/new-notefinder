import {
  type ApiErrorCode,
  processingLimitDetailsSchema,
  type TrackRequestLimit,
} from '@notefinder/contracts';

import { isApiError } from '@/lib/api/api-error';

/** A message key of a failed Track request, in the `errors` namespace. */
type RequestErrorKey =
  | `errors.${ApiErrorCode}`
  | `errors.processingLimit.${TrackRequestLimit}`;

export type RequestErrorMessage = {
  key: RequestErrorKey;
  values?: { max: number };
};

/**
 * The toast of a failed Track request: one message per limit when the API
 * says which limit was reached, otherwise the message of the error code.
 */
export function requestErrorMessage(error: unknown): RequestErrorMessage {
  if (!isApiError(error)) return { key: 'errors.INTERNAL_ERROR' };
  if (error.code !== 'PROCESSING_LIMIT_REACHED') {
    return { key: `errors.${error.code}` };
  }
  const details = processingLimitDetailsSchema.safeParse(error.details);
  if (!details.success) return { key: 'errors.PROCESSING_LIMIT_REACHED' };
  return {
    key: `errors.processingLimit.${details.data.limit}`,
    values: { max: details.data.max },
  };
}
