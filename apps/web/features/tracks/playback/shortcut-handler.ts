import type { PlaybackController } from './playback-controller';
import { type KeyboardLike, shortcutOfKeyboard } from './shortcuts';

/**
 * Runs the shortcut a key press stands for on the controller. Returns whether
 * it did, so the caller can stop the browser from also scrolling the page.
 */
export function handleShortcutKey(
  event: KeyboardLike,
  controller: Pick<PlaybackController, 'toggle' | 'skip'>,
): boolean {
  const shortcut = shortcutOfKeyboard(event);
  if (!shortcut) return false;
  if (shortcut.type === 'toggle') controller.toggle();
  else controller.skip(shortcut.seconds);
  return true;
}
