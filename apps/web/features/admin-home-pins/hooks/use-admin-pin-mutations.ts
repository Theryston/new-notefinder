'use client';

import type {
  CreateEditorialPinBody,
  UpdateEditorialPinBody,
} from '@notefinder/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { isApiError } from '@/lib/api/api-error';

import {
  pinFormErrorKey,
  pinFormFieldLabelKey,
  type ServerEligibilityError,
  serverEligibilityErrors,
  serverValidationFieldErrors,
} from '../admin-pin-server-error';
import { adminPinKeys } from '../admin-pins-query';
import type { PinFormCatalog } from '../pin-form';

type PinMutationCatalog = Pick<PinFormCatalog, 'maxTitleLength' | 'maxTracks'>;

type ErrorTranslator = ReturnType<typeof useTranslations<'errors'>>;
type FormTranslator = ReturnType<typeof useTranslations<'adminHomePins.form'>>;

function detailOf(
  field: { field: Parameters<typeof pinFormErrorKey>[0]; type: string },
  tForm: FormTranslator,
  tErrors: ErrorTranslator,
  catalog?: PinMutationCatalog,
): string {
  const key = pinFormErrorKey(field.field, field.type);
  try {
    if (key === 'errors.tooLong' && catalog) {
      return tForm(key, { max: catalog.maxTitleLength });
    }
    if (key === 'errors.tooMany' && catalog) {
      return tForm(key, { max: catalog.maxTracks });
    }
    return tForm(key);
  } catch {
    return tErrors('VALIDATION_FAILED');
  }
}

function toastFieldFailure(
  error: unknown,
  tErrors: ErrorTranslator,
  tForm: FormTranslator,
  catalog?: PinMutationCatalog,
): void {
  const first = serverValidationFieldErrors(error)[0];
  if (!first) return;
  const detail = detailOf(first, tForm, tErrors, catalog);
  try {
    toast.error(`${tForm(pinFormFieldLabelKey(first.field))}: ${detail}`);
  } catch {
    toast.error(detail);
  }
}

/** Every toast is translated: eligibility names the refusing Tracks by ID. */
function toastEligibilityFailure(
  error: unknown,
  tForm: FormTranslator,
): boolean {
  const refusals = serverEligibilityErrors(error);
  if (refusals.length === 0) return false;
  for (const refusal of refusals) {
    toast.error(eligibilityMessage(refusal, tForm));
  }
  return true;
}

function eligibilityMessage(
  { kind, trackIds }: ServerEligibilityError,
  tForm: FormTranslator,
): string {
  if (kind === 'source') return tForm('errors.sourceNotEligible');
  const ids = trackIds.join(', ');
  return kind === 'hero-needs-cover'
    ? tForm('errors.heroNeedsCover', { ids })
    : tForm('errors.tracksNotReady', { ids });
}

function toastCodeFailure(error: unknown, tErrors: ErrorTranslator): void {
  try {
    toast.error(tErrors(isApiError(error) ? error.code : 'INTERNAL_ERROR'));
  } catch {
    toast.error(tErrors('INTERNAL_ERROR'));
  }
}

/**
 * Creates, changes and removes pins. The fetcher (and its contracts
 * schemas) loads on the first save, so Zod stays out of the page's
 * first-load JavaScript. A failure toasts the translated API error; a
 * `VALIDATION_FAILED` with the backend's issues toasts the specific
 * field (`Label: reason`), while refused Tracks and sources toast their
 * translated reason with the refusing IDs. The list refreshes after every
 * change.
 */
export function useAdminPinMutations(catalog?: PinMutationCatalog) {
  const queryClient = useQueryClient();
  const tErrors = useTranslations('errors');
  const tForm = useTranslations('adminHomePins.form');
  const fail = (error: unknown) => {
    if (toastEligibilityFailure(error, tForm)) return;
    if (serverValidationFieldErrors(error).length > 0) {
      toastFieldFailure(error, tErrors, tForm, catalog);
      return;
    }
    toastCodeFailure(error, tErrors);
  };
  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: adminPinKeys.all });
  };

  const createPin = useMutation({
    mutationFn: async (body: CreateEditorialPinBody) => {
      const { createAdminPin } = await import('../admin-pins-client');
      return createAdminPin(body);
    },
    onSuccess: settle,
    onError: (error: unknown) => fail(error),
  });

  const updatePin = useMutation({
    mutationFn: async ({
      pinId,
      body,
    }: {
      pinId: string;
      body: UpdateEditorialPinBody;
    }) => {
      const { updateAdminPin } = await import('../admin-pins-client');
      return updateAdminPin(pinId, body);
    },
    onSuccess: settle,
    onError: (error: unknown) => fail(error),
  });

  const deletePin = useMutation({
    mutationFn: async (pinId: string) => {
      const { deleteAdminPin } = await import('../admin-pins-client');
      return deleteAdminPin(pinId);
    },
    onSuccess: settle,
    onError: (error: unknown) => fail(error),
  });

  return { createPin, updatePin, deletePin };
}
