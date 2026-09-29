type HotkeyEvent = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'defaultPrevented' | 'repeat'
>;

/** `⌘K` (macOS) or `Ctrl K` (everywhere else): focus the search. */
export function isSearchHotkey(event: HotkeyEvent): boolean {
  return (
    !event.defaultPrevented &&
    !event.repeat &&
    !event.altKey &&
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === 'k'
  );
}

/** The shortcut hint for `platform` (`navigator.platform`). */
export function searchHotkeyLabel(platform: string): string {
  return /mac|iphone|ipad/i.test(platform) ? '⌘K' : 'Ctrl K';
}
