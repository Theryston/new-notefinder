'use client';

import { cn } from 'cn';
import {
  CheckIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const statusBadgeClassName =
  'flex size-5 shrink-0 items-center justify-center rounded-full text-white [&_svg]:size-3';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position="bottom-center"
      gap={8}
      icons={{
        success: (
          <span className={cn(statusBadgeClassName, 'bg-success')}>
            <CheckIcon aria-hidden="true" />
          </span>
        ),
        info: (
          <span
            className={cn(
              statusBadgeClassName,
              'bg-foreground text-background',
            )}
          >
            <InfoIcon aria-hidden="true" />
          </span>
        ),
        warning: (
          <span className={cn(statusBadgeClassName, 'bg-warning')}>
            <TriangleAlertIcon aria-hidden="true" />
          </span>
        ),
        error: (
          <span className={cn(statusBadgeClassName, 'bg-destructive')}>
            <XIcon aria-hidden="true" />
          </span>
        ),
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--glass)',
          '--normal-text': 'var(--foreground)',
          '--normal-border': 'var(--glass-border)',
          '--border-radius': 'var(--radius-xl)',
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'glass rounded-xl px-4 py-3 font-medium text-sm',
          title: 'font-medium text-sm',
          description: 'text-muted-foreground text-sm',
          actionButton:
            'rounded-full px-3 py-1 font-semibold text-sm hover:bg-foreground/10',
          cancelButton:
            'rounded-full px-3 py-1 font-semibold text-sm hover:bg-foreground/10',
          icon: 'm-0',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
