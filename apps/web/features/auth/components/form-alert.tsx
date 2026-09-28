import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** A form-level message (API errors, confirmations), announced when shown. */
export function FormAlert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success';
  children: ReactNode;
}) {
  const Icon = tone === 'error' ? CircleAlertIcon : CircleCheckIcon;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'fade-in slide-in-from-top-1 flex animate-in items-start gap-2.5 rounded-xl px-4 py-3 font-medium text-sm duration-200 ease-out-soft',
        tone === 'error'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-success/10 text-foreground',
      )}
    >
      <Icon
        className={cn(
          'mt-px size-4 shrink-0',
          tone === 'success' && 'text-success',
        )}
      />
      <p>{children}</p>
    </div>
  );
}
