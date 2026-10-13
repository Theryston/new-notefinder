'use client';

import { type RefObject, useEffect, useState } from 'react';

import { PlaybackController } from '../playback/playback-controller';
import { createPlayer } from '../player/create-player';
import { playbackStore } from '../stores/playback-store';

type UsePlaybackOptions = {
  /** The element the video mounts into; set while the dock is on screen. */
  hostRef: RefObject<HTMLElement | null>;
  /** Null for a Track whose Processing chose no video: nothing plays. */
  videoId: string | null;
  durationSeconds: number;
  fake: boolean;
};

const animationFrames = {
  request: (callback: () => void) => requestAnimationFrame(callback),
  cancel: (handle: number) => cancelAnimationFrame(handle),
};

/**
 * Creates the player for a video and the controller that drives it, and tears
 * both down when the video changes or the page leaves. Returns null until the
 * controller exists; the playback store says when the player is ready.
 */
export function usePlayback({
  hostRef,
  videoId,
  durationSeconds,
  fake,
}: UsePlaybackOptions): PlaybackController | null {
  const [controller, setController] = useState<PlaybackController | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || videoId === null) return;
    let cancelled = false;
    let created: PlaybackController | null = null;

    createPlayer({ host, durationSeconds, fake })
      .then((player) => {
        if (cancelled) {
          player.destroy();
          return;
        }
        created = new PlaybackController({
          port: player,
          store: playbackStore,
          frames: animationFrames,
          durationHint: durationSeconds,
        });
        setController(created);
        return player.load(videoId);
      })
      .catch(() => {
        // The player never became ready: the dock keeps its loading state.
      });

    return () => {
      cancelled = true;
      created?.dispose();
      setController(null);
    };
  }, [hostRef, videoId, durationSeconds, fake]);

  return controller;
}
