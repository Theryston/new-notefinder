import { audioProgressOf, progressUrlOf } from './audio-progress.js';

describe('progressUrlOf', () => {
  it('reads the progress URL a conversion request answers with', () => {
    expect(
      progressUrlOf({ progress_url: 'https://rapidapi.test/progress/abc' }),
    ).toBe('https://rapidapi.test/progress/abc');
  });

  it('refuses an answer without a progress URL', () => {
    expect(() => progressUrlOf({})).toThrow();
  });

  it('refuses a progress URL that is not a URL', () => {
    expect(() => progressUrlOf({ progress_url: 'not a url' })).toThrow();
  });
});

describe('audioProgressOf', () => {
  it('is still converting while neither progress nor success has finished', () => {
    expect(audioProgressOf({ progress: 500, success: 0 })).toEqual({
      ready: false,
    });
    expect(audioProgressOf({})).toEqual({ ready: false });
  });

  it('is not ready just short of the end, at 999 per mille', () => {
    expect(audioProgressOf({ progress: 999, success: 0 })).toEqual({
      ready: false,
    });
  });

  it('is ready at its download URL once progress reaches 1000', () => {
    expect(
      audioProgressOf({
        progress: 1000,
        download_url: 'https://files.test/abc.mp3',
      }),
    ).toEqual({ ready: true, downloadUrl: 'https://files.test/abc.mp3' });
  });

  it('is ready at its download URL once success is 1', () => {
    expect(
      audioProgressOf({
        success: 1,
        download_url: 'https://files.test/abc.mp3',
      }),
    ).toEqual({ ready: true, downloadUrl: 'https://files.test/abc.mp3' });
  });

  it('refuses a finished conversion that names no download URL', () => {
    expect(() => audioProgressOf({ progress: 1000 })).toThrow(
      'without a download URL',
    );
    expect(() => audioProgressOf({ success: 1, download_url: '' })).toThrow(
      'without a download URL',
    );
  });

  it('refuses an answer that is not a progress answer', () => {
    expect(() => audioProgressOf({ progress: 'half' })).toThrow();
  });
});
