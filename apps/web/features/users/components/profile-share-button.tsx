'use client';

import { Share2Icon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';

// Loaded on the first click, on the client only: the dialog's Base UI parts
// stay out of the page's first-load JS until someone asks to share.
const ProfileShareDialog = dynamic(
  () =>
    import('./profile-share-dialog').then(
      (module) => module.ProfileShareDialog,
    ),
  { ssr: false },
);

/** The banner's Share button; it opens the share dialog for the Profile. */
export function ProfileShareButton({
  name,
  url,
}: {
  name: string;
  url: string;
}) {
  const t = useTranslations('share.profile');
  // Bumped on each open: a new key mounts the dialog afresh, so its copy
  // state and the moment-less link start over every time it opens.
  const [mountKey, setMountKey] = useState(0);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        aria-haspopup="dialog"
        className="bg-foreground text-background hover:bg-foreground/90"
        onClick={() => {
          setMountKey((value) => value + 1);
          setOpen(true);
        }}
      >
        <Share2Icon aria-hidden="true" />
        {t('open')}
      </Button>
      {mountKey > 0 ? (
        <ProfileShareDialog
          key={mountKey}
          name={name}
          url={url}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
      {/* Mounted with the button, outside the dialog: a failed copy toasts here. */}
      <Toaster />
    </>
  );
}
