'use client';

import { OTP_LENGTH } from '@notefinder/contracts/auth-rules';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import type { RefCallBack } from 'react-hook-form';

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';

const SLOTS = Array.from({ length: OTP_LENGTH }, (_, index) => index);
const SLOT_GROUPS = [
  SLOTS.slice(0, OTP_LENGTH / 2),
  SLOTS.slice(OTP_LENGTH / 2),
];

/** Whether `code` has every digit of an emailed code. */
export const isCompleteCode = (code: string): boolean =>
  code.length === OTP_LENGTH;

function CodeSlots({ invalid }: { invalid: boolean }) {
  return (
    <div className="flex gap-3 sm:gap-4">
      {SLOT_GROUPS.map((group) => (
        <InputOTPGroup key={group[0]}>
          {group.map((index) => (
            <InputOTPSlot
              key={index}
              index={index}
              aria-invalid={invalid || undefined}
            />
          ))}
        </InputOTPGroup>
      ))}
    </div>
  );
}

/** The `field` react-hook-form's `Controller` renders an `otp` field with. */
type CodeField = {
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  ref: RefCallBack;
};

/**
 * The emailed 6-digit code (email verification, password reset), rendered
 * by a `Controller` of the form's `otp` field.
 */
export function CodeInput({
  field,
  label,
  invalid,
  onComplete,
}: {
  field: CodeField;
  label: string;
  invalid: boolean;
  onComplete: () => void;
}) {
  return (
    <InputOTP
      ref={field.ref}
      name={field.name}
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      onComplete={onComplete}
      maxLength={OTP_LENGTH}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      aria-label={label}
    >
      <CodeSlots invalid={invalid} />
    </InputOTP>
  );
}
