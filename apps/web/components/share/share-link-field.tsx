'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

export type ShareLinkLabels = {
  link: string;
  copy: string;
  copied: string;
  copyFailed: string;
};

/** The link as selectable text, with a button that copies it. */
export function ShareLinkField({
  link,
  labels,
}: {
  link: string;
  labels: ShareLinkLabels;
}) {
  const linkRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // No clipboard permission or API: leave the link selected for Ctrl+C.
      linkRef.current?.select();
      toast.error(labels.copyFailed);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={linkRef}
        readOnly
        value={link}
        aria-label={labels.link}
        onFocus={(event) => event.currentTarget.select()}
        className="h-10 min-w-0 flex-1 rounded-full border border-input bg-muted px-4 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button type="button" onClick={() => void copy()}>
        {copied ? (
          <CheckIcon aria-hidden="true" />
        ) : (
          <CopyIcon aria-hidden="true" />
        )}
        {copied ? labels.copied : labels.copy}
      </Button>
    </div>
  );
}
