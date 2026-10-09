import type { TrackProcessingVideoSource } from '@notefinder/contracts';

// What a Processing stores as its steps run (CONTEXT.md "Processing"). A retry
// keeps the outputs of the failed run, so the steps that already ran are not
// run again. Every output of a Processing is listed in `ProcessingOutputs`, so a
// step that stores a new one (ADR 0004) fails to compile in `carriedOutputsOf`
// until it decides whether a retry carries it over.

/** The outputs of one Processing, as its row holds them; null until a step stores one. */
export type ProcessingOutputs = {
  videoId: string | null;
  videoSource: TrackProcessingVideoSource | null;
  musicWavUrl: string | null;
  musicMp3Url: string | null;
  vocalsWavUrl: string | null;
  vocalsMp3Url: string | null;
  /** The RunPod job of the note detection, which the step polls. */
  runpodJobId: string | null;
};

export type ProcessingOutputKey = keyof ProcessingOutputs;

/** The outputs a retry carries over: every output except the external job's. */
export type CarriedOutputs = Omit<ProcessingOutputs, 'runpodJobId'>;

/**
 * The outputs a retry starts with. The RunPod job belongs to a run that may have
 * failed on RunPod, so a retry starts a fresh job and does not carry its ID. The
 * literal is checked against `CarriedOutputs`, so an output added there must be
 * carried here.
 */
export function carriedOutputsOf(outputs: ProcessingOutputs): CarriedOutputs {
  return {
    videoId: outputs.videoId,
    videoSource: outputs.videoSource,
    musicWavUrl: outputs.musicWavUrl,
    musicMp3Url: outputs.musicMp3Url,
    vocalsWavUrl: outputs.vocalsWavUrl,
    vocalsMp3Url: outputs.vocalsMp3Url,
  } satisfies CarriedOutputs;
}

/** Which MP3 of a Processing: the music's or the vocals'. */
export type Mp3Kind = 'music' | 'vocals';

/** The audio URLs of a Processing: each is null until a step stores it. */
export type StoredAudioUrls = Pick<
  ProcessingOutputs,
  'musicWavUrl' | 'musicMp3Url' | 'vocalsWavUrl' | 'vocalsMp3Url'
>;

/** The Processing an MP3 or lyrics write belongs to: only its ID and its Track. */
export type ProcessingRef = { id: string; trackId: string };
