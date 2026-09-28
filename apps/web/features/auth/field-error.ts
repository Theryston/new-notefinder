/** The messages each field has under `auth.fields.<field>.errors`. */
type FieldErrorKinds = {
  name: 'required' | 'invalid';
  email: 'invalid';
  password: 'tooShort' | 'tooLong' | 'invalid';
  username: 'tooShort' | 'tooLong' | 'invalid';
};

type FieldName = keyof FieldErrorKinds;

export type FieldErrorKey<F extends FieldName> =
  `${F}.errors.${FieldErrorKinds[F]}`;

/**
 * Zod issue codes (the `type` react-hook-form reports with `zodResolver`)
 * that have a more specific message than the field's generic `invalid`.
 */
const SPECIFIC_ERRORS: {
  [F in FieldName]: Partial<Record<string, FieldErrorKinds[F]>>;
} = {
  name: { too_small: 'required' },
  email: {},
  password: { too_small: 'tooShort', too_big: 'tooLong' },
  username: { too_small: 'tooShort', too_big: 'tooLong' },
};

/**
 * Message key (under `auth.fields`) for a validation error of `field`, so
 * validation text comes from i18n instead of the schema.
 */
export function fieldErrorKey<F extends FieldName>(
  field: F,
  type: string | undefined,
): FieldErrorKey<F> {
  const specific: Partial<Record<string, string>> = SPECIFIC_ERRORS[field];
  const kind = (type === undefined ? undefined : specific[type]) ?? 'invalid';
  // `kind` comes from this field's own table (or is `invalid`, which every
  // field has), so the key exists.
  return `${field}.errors.${kind}` as FieldErrorKey<F>;
}
