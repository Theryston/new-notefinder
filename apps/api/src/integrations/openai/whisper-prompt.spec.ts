import { whisperPromptOf } from './whisper-prompt.js';

describe('whisperPromptOf', () => {
  it('sends no prompt when the Recording has no Lyrics', () => {
    expect(whisperPromptOf(null)).toBeUndefined();
  });

  it('sends no prompt when the Lyrics are blank', () => {
    expect(whisperPromptOf('  \n\t ')).toBeUndefined();
  });

  it('sends the Lyrics without the blanks around them', () => {
    expect(whisperPromptOf('\n  Is this the real life?\n')).toBe(
      'Is this the real life?',
    );
  });

  it('keeps Lyrics within the prompt limit as they are', () => {
    const lyrics = 'a'.repeat(800);

    expect(whisperPromptOf(lyrics)).toBe(lyrics);
  });

  it('cuts Lyrics over the limit to 800 characters', () => {
    const lyrics = 'b'.repeat(900);

    expect(whisperPromptOf(lyrics)).toBe('b'.repeat(800));
  });

  it('never cuts a character in two, so the prompt stays valid text', () => {
    // An emoji is two UTF-16 code units: a cut by code unit would split it.
    const lyrics = `${'c'.repeat(799)}🎤 and more`;

    expect(whisperPromptOf(lyrics)).toBe(`${'c'.repeat(799)}🎤`);
  });
});
