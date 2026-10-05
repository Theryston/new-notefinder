import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from 'cn';
import type * as React from 'react';

/**
 * The text field: a `bg-muted` pill that holds the native input plus an
 * optional `start` (icon, "@") and `end` (hint, toggle) slot, so adornments
 * sit inside the pill and the focus ring wraps all of it. `className` styles
 * the pill, `inputClassName` the native input.
 */
function Input({
  className,
  inputClassName,
  start,
  end,
  type,
  ...props
}: React.ComponentProps<'input'> & {
  inputClassName?: string;
  start?: React.ReactNode;
  end?: React.ReactNode;
}) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "flex h-10 w-full min-w-0 cursor-text items-center gap-2 rounded-full border border-transparent bg-muted px-4 text-muted-foreground transition-[border-color,box-shadow] duration-150 ease-out has-[input:disabled]:pointer-events-none has-[input:disabled]:cursor-not-allowed has-[input:focus-visible]:border-ring has-aria-invalid:border-destructive has-[input:disabled]:opacity-50 has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50 has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
        className,
      )}
    >
      {start}
      <InputPrimitive
        type={type}
        data-slot="input"
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm',
          inputClassName,
        )}
        {...props}
      />
      {end}
    </div>
  );
}

export { Input };
