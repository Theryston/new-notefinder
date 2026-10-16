'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Refresh streamed server data only after polling observes the completed Processing. */
export function RefreshPracticeOnCompletion({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (enabled) router.refresh();
  }, [enabled, router]);
  return null;
}
