import {
  carriedOutputsOf,
  type ProcessingOutputs,
} from './track-processing-outputs.js';

const outputs: ProcessingOutputs = {
  videoId: 'aaaaaaaaaaa',
  videoSource: 'musicbrainz',
  musicWavUrl: 'https://storage.test/music.wav',
  musicMp3Url: 'https://storage.test/music.mp3',
  vocalsWavUrl: 'https://storage.test/vocals.wav',
  vocalsMp3Url: 'https://storage.test/vocals.mp3',
  runpodJobId: 'runpod-job-1',
};

describe('carriedOutputsOf', () => {
  it('carries the video, the stored audio and the vocals over', () => {
    expect(carriedOutputsOf(outputs)).toEqual({
      videoId: 'aaaaaaaaaaa',
      videoSource: 'musicbrainz',
      musicWavUrl: 'https://storage.test/music.wav',
      musicMp3Url: 'https://storage.test/music.mp3',
      vocalsWavUrl: 'https://storage.test/vocals.wav',
      vocalsMp3Url: 'https://storage.test/vocals.mp3',
    });
  });

  it('does not carry the RunPod job of the failed run', () => {
    expect(carriedOutputsOf(outputs)).not.toHaveProperty('runpodJobId');
  });

  it('carries the nulls of outputs the failed run never stored', () => {
    expect(
      carriedOutputsOf({
        ...outputs,
        videoId: null,
        videoSource: null,
        vocalsWavUrl: null,
      }),
    ).toMatchObject({ videoId: null, videoSource: null, vocalsWavUrl: null });
  });
});
