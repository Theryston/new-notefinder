import { describe, expect, it, vi } from 'vitest';

import { handleShortcutKey } from './shortcut-handler';
import type { KeyboardLike } from './shortcuts';

const key = (overrides: Partial<KeyboardLike>): KeyboardLike => ({
  key: ' ',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  target: null,
  ...overrides,
});

const controller = () => ({ toggle: vi.fn(), skip: vi.fn() });

describe('handleShortcutKey', () => {
  it('toggles playback on space and says it handled the key', () => {
    const target = controller();

    expect(handleShortcutKey(key({ key: ' ' }), target)).toBe(true);

    expect(target.toggle).toHaveBeenCalledOnce();
  });

  it('skips 5 seconds on the arrows', () => {
    const target = controller();

    handleShortcutKey(key({ key: 'ArrowRight' }), target);
    handleShortcutKey(key({ key: 'ArrowLeft' }), target);

    expect(target.skip.mock.calls).toEqual([[5], [-5]]);
  });

  it('does nothing, and says so, for any other key', () => {
    const target = controller();

    expect(handleShortcutKey(key({ key: 'a' }), target)).toBe(false);

    expect(target.toggle).not.toHaveBeenCalled();
    expect(target.skip).not.toHaveBeenCalled();
  });
});
