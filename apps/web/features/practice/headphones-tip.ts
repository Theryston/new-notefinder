const STORAGE_KEY = 'notefinder:headphones-tip-seen';

/**
 * Whether this is the first time the mic is turned on in this browser, and
 * remembers it. Storage can be unavailable (private windows, blocked site
 * data); then the tip is simply shown every time, which is harmless.
 */
export function takeHeadphonesTip(): boolean {
  try {
    if (localStorage.getItem(STORAGE_KEY) !== null) return false;
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    return true;
  }
  return true;
}
