'use client';

import type { ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { ShareLinkField, type ShareLinkLabels } from './share-link-field';
import { ShareNetworkShortcuts } from './share-network-shortcuts';
import type { ShareMessage, ShareNetwork } from './share-networks';

/**
 * The share dialog every share surface uses: the link with a copy button,
 * optional `children` (a page's own options, such as a checkbox) and the
 * network shortcuts. The caller translates every label.
 */
export function ShareDialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  link,
  linkLabels,
  message,
  networksLabel,
  networkName,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  closeLabel: string;
  link: string;
  linkLabels: ShareLinkLabels;
  message: ShareMessage;
  networksLabel: string;
  networkName: (network: ShareNetwork) => string;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={closeLabel}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ShareLinkField link={link} labels={linkLabels} />
        {children}
        <ShareNetworkShortcuts
          message={message}
          label={networksLabel}
          networkName={networkName}
        />
      </DialogContent>
    </Dialog>
  );
}
