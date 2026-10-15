/**
 * Calls `onHidden` when the page goes away: the tab is hidden (the browser
 * keeps the recording indicator on for a hidden tab) or the page is leaving.
 * Returns the function that stops listening.
 */
export function watchPageHidden(onHidden: () => void): () => void {
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') onHidden();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onHidden);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onHidden);
  };
}

/** Whether the tab is hidden right now. */
export function isPageHidden(): boolean {
  return document.visibilityState === 'hidden';
}
