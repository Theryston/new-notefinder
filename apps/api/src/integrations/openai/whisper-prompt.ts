// The prompt a transcription is guided by: the Recording's plain Lyrics. Whisper
// reads at most 224 tokens of prompt; 800 characters stay within that for lyrics
// in Latin scripts, and a longer prompt would only be cut by the service.
const PROMPT_MAX_CHARACTERS = 800;

/**
 * The prompt for the Lyrics of a Recording: the Lyrics without the blanks
 * around them, cut to the prompt limit, or `undefined` when there are none.
 * The cut counts characters, not UTF-16 code units, so it never splits one.
 */
export const whisperPromptOf = (lyrics: string | null): string | undefined => {
  const text = lyrics?.trim() ?? '';
  if (text === '') {
    return undefined;
  }
  return [...text].slice(0, PROMPT_MAX_CHARACTERS).join('');
};
