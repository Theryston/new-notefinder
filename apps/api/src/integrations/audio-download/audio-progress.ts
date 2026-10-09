import { z } from 'zod';

// The answers of the RapidAPI service the legacy app downloaded YouTube audio
// through (ADR 0004). The conversion request names a progress URL, and that
// URL answers until the MP3 is ready. Parsed here, so the client only moves
// bytes and the rules of "ready" are testable on their own.

const conversionResponseSchema = z.object({
  progress_url: z.url(),
});

const progressResponseSchema = z.object({
  // Per mille: 1000 once the conversion has finished.
  progress: z.number().optional(),
  // 1 once the conversion has finished (the service sends either field).
  success: z.number().optional(),
  download_url: z.string().optional(),
});

/** Where a conversion stands: still running, or ready at this URL. */
export type AudioProgress =
  | { ready: false }
  | { ready: true; downloadUrl: string };

/** The progress URL a conversion request answers with. */
export const progressUrlOf = (body: unknown): string =>
  conversionResponseSchema.parse(body).progress_url;

/**
 * The state of a conversion from one progress answer. A conversion that has
 * finished without a download URL is a failure, not a pending one.
 */
export const audioProgressOf = (body: unknown): AudioProgress => {
  const progress = progressResponseSchema.parse(body);
  if (!isFinished(progress)) {
    return { ready: false };
  }
  if (progress.download_url === undefined || progress.download_url === '') {
    throw new Error('The conversion finished without a download URL');
  }
  return { ready: true, downloadUrl: progress.download_url };
};

const isFinished = (progress: { progress?: number; success?: number }) =>
  progress.progress === 1000 || progress.success === 1;
