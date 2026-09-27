'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactNode } from 'react';

import { ThemeProvider } from '@/components/theme-provider';
import { getQueryClient } from '@/lib/query-client';

/** Client-side providers shared by every page. */
export function Providers({ children }: { children: ReactNode }) {
  // No useState: on the server each request gets a new client and in the
  // browser `getQueryClient` returns a singleton that survives suspense.
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <ThemeProvider>{children}</ThemeProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
