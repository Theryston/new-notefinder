import type { ReactNode } from 'react';

import { FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

import { FormField } from './form-field';

/**
 * A value the user can see and copy but not change (Username, email). Not
 * `disabled`, so screen readers still read it and it can be selected.
 */
export function ReadOnlyField({
  id,
  label,
  value,
  hint,
}: {
  id: string;
  label: ReactNode;
  value: string;
  hint?: ReactNode;
}) {
  return (
    <FormField
      id={id}
      label={label}
      hint={hint ? <FieldDescription>{hint}</FieldDescription> : undefined}
    >
      <Input
        id={id}
        value={value}
        readOnly
        aria-readonly="true"
        inputClassName="text-muted-foreground"
      />
    </FormField>
  );
}
