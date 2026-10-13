import { SKIP_SECONDS } from './playback-math';

export type Shortcut = { type: 'toggle' } | { type: 'skip'; seconds: number };

/** The part of a keyboard event a shortcut needs, so it needs no DOM. */
export type ShortcutEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** Tag name of the focused element, upper case; empty for none. */
  targetTag: string;
  /** Whether that element handles the keys itself (a slider, a text field). */
  targetHandlesKeys: boolean;
};

/** The focused element, as far as a shortcut can tell. */
export type ShortcutTarget = {
  tagName: string;
  isContentEditable: boolean;
  getAttribute(name: string): string | null;
  closest(selector: string): unknown;
};

export type KeyboardLike = Omit<
  ShortcutEvent,
  'targetTag' | 'targetHandlesKeys'
> & { target: ShortcutTarget | null };

const TEXT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Whether the focused element keeps the arrow and space keys for itself: a
 * slider (the progress track), an editable field or an open menu.
 */
function handlesKeys(target: ShortcutTarget | null): boolean {
  return (
    target !== null &&
    (target.isContentEditable ||
      target.getAttribute('role') === 'slider' ||
      target.closest('[role="menu"]') !== null)
  );
}

/** {@link shortcutOf} for a real keyboard event. */
export function shortcutOfKeyboard(event: KeyboardLike): Shortcut | null {
  return shortcutOf({
    key: event.key,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    targetTag: event.target?.tagName ?? '',
    targetHandlesKeys: handlesKeys(event.target),
  });
}

/**
 * What a key press does to the player: space plays and pauses, the arrows skip
 * 5 s. A focused control keeps its own keys (space presses a button, the
 * progress slider moves itself), and chords like Ctrl+Arrow are left to the
 * browser.
 */
export function shortcutOf(event: ShortcutEvent): Shortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.targetHandlesKeys || TEXT_TAGS.has(event.targetTag)) return null;
  if (event.key === ' ') {
    return event.targetTag === 'BUTTON' ? null : { type: 'toggle' };
  }
  if (event.key === 'ArrowRight')
    return { type: 'skip', seconds: SKIP_SECONDS };
  if (event.key === 'ArrowLeft') {
    return { type: 'skip', seconds: -SKIP_SECONDS };
  }
  return null;
}
