'use client';

import { cn } from 'cn';
import { OTPInput, OTPInputContext } from 'input-otp';
import * as React from 'react';

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        'cn-input-otp flex items-center has-disabled:opacity-50',
        containerClassName,
      )}
      spellCheck={false}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn('flex items-center gap-2', className)}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  index: number;
}) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        'relative flex size-11 items-center justify-center rounded-full border border-transparent bg-muted font-mono font-semibold text-lg tabular-nums shadow-xs outline-none transition-[background-color,border-color,box-shadow,transform] duration-200 ease-spring aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[active=true]:z-10 data-[active=true]:scale-105 data-[active=true]:border-ring data-[active=true]:bg-background data-[active=true]:ring-3 data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 sm:size-12 dark:aria-invalid:ring-destructive/40 dark:data-[active=true]:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-0.5 animate-caret-blink rounded-full bg-primary duration-1000" />
        </div>
      )}
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot };
