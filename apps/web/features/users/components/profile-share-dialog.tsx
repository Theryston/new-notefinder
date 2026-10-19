'use client';

import { useTranslations } from 'next-intl';

import { ShareDialog } from '@/components/share/share-dialog';

/**
 * The Profile's share dialog: the canonical link, copy and the network
 * shortcuts. Opened from the banner for visitors and the owner alike.
 */
export function ProfileShareDialog({
  name,
  url,
  open,
  onOpenChange,
}: {
  name: string;
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('share.profile');

  return (
    <ShareDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      description={t('description', { name })}
      closeLabel={t('close')}
      link={url}
      linkLabels={{
        link: t('link'),
        copy: t('copy'),
        copied: t('copied'),
        copyFailed: t('copyFailed'),
      }}
      message={{
        url,
        text: t('text', { name }),
        subject: t('subject', { name }),
      }}
      networksLabel={t('networks')}
      networkName={(network) => t(`network.${network}`)}
    />
  );
}
