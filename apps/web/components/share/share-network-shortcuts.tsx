import { buttonVariants } from '@/components/ui/button';

import {
  SHARE_NETWORKS,
  type ShareMessage,
  type ShareNetwork,
  shareHref,
} from './share-networks';

/** One link per network, opening its share page (or the mail client). */
export function ShareNetworkShortcuts({
  message,
  label,
  networkName,
}: {
  message: ShareMessage;
  label: string;
  networkName: (network: ShareNetwork) => string;
}) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {SHARE_NETWORKS.map((network) => (
        <li key={network}>
          <a
            href={shareHref(network, message)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline' })}
          >
            {networkName(network)}
          </a>
        </li>
      ))}
    </ul>
  );
}
