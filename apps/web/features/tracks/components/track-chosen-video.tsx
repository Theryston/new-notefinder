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
      className="flex flex-col gap-4 sm:flex-row sm:items-center"
    >
      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-56">
        <Image
          src={youtubeThumbnailUrl(video.id)}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 640px) 100vw, 224px"
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
