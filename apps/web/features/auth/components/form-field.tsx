import type { ReactNode } from 'react';

import { Field, FieldError, FieldLabel } from '@/components/ui/field';

/** ARIA props that tie an input to the error its `FormField` shows. */
export const fieldErrorProps = (id: string, invalid: boolean) => ({
  'aria-invalid': invalid || undefined,
  'aria-describedby': invalid ? `${id}-error` : undefined,
});

/**
 * Label (with an optional `action` link beside it), control and either the
 * validation error or a hint below it.
 */
export function FormField({
  id,
  label,
  action,
  error,
  hint,
  children,
}: {
  id: string;
  label: ReactNode;
  action?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  const fieldLabel = (
    <FieldLabel
      htmlFor={id}
      className="font-semibold text-[0.8125rem] text-foreground"
    >
      {label}
    </FieldLabel>
  );

  return (
    <Field data-invalid={error ? true : undefined} className="gap-2">
      {action ? (
        <div className="flex items-center justify-between gap-3">
          {fieldLabel}
          {action}
        </div>
      ) : (
        fieldLabel
      )}
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint}
    </Field>
  );
}
