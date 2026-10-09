import type { TrackProcessingVideo } from '@notefinder/contracts';
import { ExternalLinkIcon } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { youtubeThumbnailUrl, youtubeWatchUrl } from '../youtube-links';

/**
 * The video the Processing chose, the one the timeline will play: a small
 * thumbnail, where it came from, and a link to watch it on YouTube. The player
 * itself is not loaded here.
 */
export function TrackChosenVideo({ video }: { video: TrackProcessingVideo }) {
  const t = useTranslations('tracks.processing.video');
  return (
    <section
      aria-labelledby="processing-video-title"
      className="flex items-center gap-4"
    >
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-muted">
        <Image
          src={youtubeThumbnailUrl(video.id)}
          alt=""
          fill
          unoptimized
          sizes="128px"
          className="object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 id="processing-video-title" className="font-semibold text-sm">
          {t('title')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t(`source.${video.source}`)}
        </p>
        <a
          href={youtubeWatchUrl(video.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 font-medium text-primary text-sm underline-offset-4 hover:underline"
        >
          {t('watch')}
          <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
        </a>
      </div>
    </section>
  );
}
