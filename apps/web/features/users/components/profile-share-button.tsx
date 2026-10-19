'use client';

import { Share2Icon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

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
  const [opening, setOpening] = useState(0);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        aria-haspopup="dialog"
        onClick={() => {
          setOpening((value) => value + 1);
          setOpen(true);
        }}
      >
        <Share2Icon aria-hidden="true" />
        {t('open')}
      </Button>
      {opening > 0 ? (
        <ProfileShareDialog
          key={opening}
          name={name}
          url={url}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}
