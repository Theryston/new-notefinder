import type { ReactNode } from 'react';

import { Field, FieldError, FieldLabel } from '@/components/ui/field';

/** Label, control and either the validation error or a hint below it. */
export function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Field data-invalid={error ? true : undefined} className="gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint}
    </Field>
  );
}
