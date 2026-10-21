import type { FieldErrors, Resolver } from 'react-hook-form';

import {
  formValuesToBody,
  type PinFormValues,
  pinFormFieldForPath,
} from './pin-form';

let loading: Promise<unknown> | undefined;

/**
 * Loads Zod and the pin schemas now (call it once the form is on screen),
 * so the first validation doesn't wait for the chunk.
 */
export function preloadPinFormSchema(): Promise<unknown> {
  loading ??= import('@notefinder/contracts').catch((error: unknown) => {
    // A failed chunk load is retried on the next validation.
    loading = undefined;
    throw error;
  });
  return loading;
}

/**
 * Validates the form as the body the admin endpoint checks: the values are
 * mapped first, so cross-field rules (titles per locale, the window order,
 * the kind and layout agreeing) report on the right field. The Zod issue
 * code becomes the error `type`, which the form maps to a translated
 * message; Zod's own sentences never render.
 */
export const pinFormResolver: Resolver<PinFormValues> = async (values) => {
  const { createEditorialPinBodySchema } = await import(
    '@notefinder/contracts'
  );
  const startsAtValid =
    values.startsAt === '' || !Number.isNaN(Date.parse(values.startsAt));
  const endsAtValid =
    values.endsAt === '' || !Number.isNaN(Date.parse(values.endsAt));
  const parsed = createEditorialPinBodySchema.safeParse(
    formValuesToBody({
      ...values,
      startsAt: startsAtValid ? values.startsAt : '',
      endsAt: endsAtValid ? values.endsAt : '',
    }),
  );
  const errors: FieldErrors<PinFormValues> = {};
  if (!startsAtValid) errors.startsAt = { type: 'invalid_type' };
  if (!endsAtValid) errors.endsAt = { type: 'invalid_type' };
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = pinFormFieldForPath(
        issue.path.filter(
          (segment): segment is string | number =>
            typeof segment === 'string' || typeof segment === 'number',
        ),
      );
      if (!field || errors[field]) continue;
      errors[field] = { type: issue.code };
    }
  }
  if (Object.keys(errors).length === 0) return { values, errors: {} };
  return { values: {}, errors };
};
