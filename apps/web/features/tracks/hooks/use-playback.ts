'use client';

import { type RefObject, useEffect, useRef, useState } from 'react';

import { PlaybackController } from '../playback/playback-controller';
import { createPlayer } from '../player/create-player';
import { initialPlaybackState, playbackStore } from '../stores/playback-store';

type UsePlaybackOptions = {
  /** The element the video mounts into; set while the dock is on screen. */
  hostRef: RefObject<HTMLElement | null>;
  /** Null for a Track whose Processing chose no video: nothing plays. */
  videoId: string | null;
  /**
   * The Track's length until the player knows it. It may change while the page
   * is open (the notes arrive later), and that never rebuilds the player.
   */
  durationSeconds: number;
  fake: boolean;
};

const animationFrames = {
  request: (callback: () => void) => requestAnimationFrame(callback),
  cancel: (handle: number) => cancelAnimationFrame(handle),
};

/** The dock shows its error when the player could not even be created. */
function failPlayback() {
  playbackStore.setState({ status: 'error' });
}

/**
 * Creates the player for a video and the controller that drives it, and tears
 * both down when the video changes or the page leaves. Returns null until the
 * controller exists; the playback store says when the player is ready, or
 * that it failed.
 */
export function usePlayback({
  hostRef,
  videoId,
  durationSeconds,
  fake,
}: UsePlaybackOptions): PlaybackController | null {
  const [controller, setController] = useState<PlaybackController | null>(null);
  const durationRef = useRef(durationSeconds);
  durationRef.current = durationSeconds;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || videoId === null) return;
    let cancelled = false;
    let created: PlaybackController | null = null;
    playbackStore.setState(initialPlaybackState);

    createPlayer({ host, durationSeconds: durationRef.current, fake })
      .then((player) => {
        if (cancelled) {
          player.destroy();
          return;
        }
        created = new PlaybackController({
          port: player,
          store: playbackStore,
          frames: animationFrames,
          durationHint: durationRef.current,
        });
        setController(created);
        return player.load(videoId);
      })
      .catch(() => {
        // The IFrame API never loaded (blocked, offline): say so, don't wait.
        if (!cancelled) failPlayback();
      });

    return () => {
      cancelled = true;
      created?.dispose();
      setController(null);
    };
  }, [hostRef, videoId, fake]);

  useEffect(() => {
    controller?.setDurationHint(durationSeconds);
  }, [controller, durationSeconds]);

  return controller;
}
