'use client';

import {
  ExternalLinkIcon,
  EyeOffIcon,
  SettingsIcon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { PlaybackController } from '../playback/playback-controller';
import { PLAYBACK_RATES } from '../player/player-port';
import { usePlaybackState } from '../stores/playback-store';
import { youtubeWatchUrl } from '../youtube-links';

/**
 * The dock's Settings menu: speed, mute, "Open on YouTube" and "Hide video".
 * It is a dynamic import of the dock (Base UI's menu is heavy), so listening
 * costs it nothing until the first paint after the page.
 */
export function DockSettings({
  controller,
  videoId,
}: {
  controller: PlaybackController | null;
  videoId: string;
}) {
  const t = useTranslations('tracks.practice.dock');
  const rate = usePlaybackState((state) => state.rate);
  const muted = usePlaybackState((state) => state.muted);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={t('settings')} />
        }
      >
        <SettingsIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={12}
        className="w-auto"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('speed')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={String(rate)}
            onValueChange={(value) => controller?.setRate(Number(value))}
          >
            {PLAYBACK_RATES.map((option) => (
              <DropdownMenuRadioItem key={option} value={String(option)}>
                <span className="font-mono tabular-nums">
                  {t('speedOption', { rate: option })}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={muted}
          onCheckedChange={() => controller?.toggleMuted()}
        >
          {muted ? (
            <VolumeXIcon aria-hidden="true" />
          ) : (
            <Volume2Icon aria-hidden="true" />
          )}
          {t('mute')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem
          render={
            <a
              href={youtubeWatchUrl(videoId)}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <ExternalLinkIcon aria-hidden="true" />
          {t('openOnYouTube')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => controller?.hideVideo()}>
          <EyeOffIcon aria-hidden="true" />
          {t('hideVideo')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
