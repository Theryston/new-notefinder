import { describe, expect, it } from 'vitest';

import {
  type KeyboardLike,
  type ShortcutEvent,
  type ShortcutTarget,
  shortcutOf,
  shortcutOfKeyboard,
} from './shortcuts';

const press = (overrides: Partial<ShortcutEvent>): ShortcutEvent => ({
  key: ' ',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  targetTag: 'BODY',
  targetHandlesKeys: false,
  ...overrides,
});

describe('shortcutOf', () => {
  it('plays and pauses with space', () => {
    expect(shortcutOf(press({ key: ' ' }))).toEqual({ type: 'toggle' });
  });

  it('skips 5 seconds with the arrows', () => {
    expect(shortcutOf(press({ key: 'ArrowRight' }))).toEqual({
      type: 'skip',
      seconds: 5,
    });
    expect(shortcutOf(press({ key: 'ArrowLeft' }))).toEqual({
      type: 'skip',
      seconds: -5,
    });
  });

  it('ignores other keys', () => {
    expect(shortcutOf(press({ key: 'a' }))).toBeNull();
  });

  it('leaves space to a focused button, which it presses', () => {
    expect(shortcutOf(press({ targetTag: 'BUTTON' }))).toBeNull();
  });

  it('still skips with the arrows while a button is focused', () => {
    expect(
      shortcutOf(press({ key: 'ArrowRight', targetTag: 'BUTTON' })),
    ).toEqual({ type: 'skip', seconds: 5 });
  });

  it('leaves the keys to text fields', () => {
    expect(shortcutOf(press({ targetTag: 'INPUT' }))).toBeNull();
    expect(
      shortcutOf(press({ key: 'ArrowLeft', targetTag: 'TEXTAREA' })),
    ).toBeNull();
  });

  it('leaves the keys to a control that handles them, like a slider', () => {
    expect(
      shortcutOf(press({ key: 'ArrowRight', targetHandlesKeys: true })),
    ).toBeNull();
  });

  it('leaves chords to the browser', () => {
    expect(shortcutOf(press({ key: 'ArrowLeft', altKey: true }))).toBeNull();
    expect(shortcutOf(press({ key: ' ', ctrlKey: true }))).toBeNull();
    expect(shortcutOf(press({ key: 'ArrowRight', metaKey: true }))).toBeNull();
  });
});

describe('shortcutOfKeyboard', () => {
  const target = (overrides: Partial<ShortcutTarget> = {}): ShortcutTarget => ({
    tagName: 'DIV',
    isContentEditable: false,
    getAttribute: () => null,
    closest: () => null,
    ...overrides,
  });
  const keyboard = (overrides: Partial<KeyboardLike>): KeyboardLike => ({
    key: ' ',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: target(),
    ...overrides,
  });

  it('works from the page itself, with nothing focused', () => {
    expect(shortcutOfKeyboard(keyboard({ target: null }))).toEqual({
      type: 'toggle',
    });
  });

  it('leaves the keys to a focused slider', () => {
    const slider = target({
      getAttribute: (name) => (name === 'role' ? 'slider' : null),
    });

    expect(
      shortcutOfKeyboard(keyboard({ key: 'ArrowLeft', target: slider })),
    ).toBeNull();
  });

  it('leaves the keys to an open menu and to editable content', () => {
    expect(
      shortcutOfKeyboard(keyboard({ target: target({ closest: () => ({}) }) })),
    ).toBeNull();
    expect(
      shortcutOfKeyboard(
        keyboard({ target: target({ isContentEditable: true }) }),
      ),
    ).toBeNull();
  });

  it('leaves space to a focused button', () => {
    expect(
      shortcutOfKeyboard(keyboard({ target: target({ tagName: 'BUTTON' }) })),
    ).toBeNull();
  });
});
