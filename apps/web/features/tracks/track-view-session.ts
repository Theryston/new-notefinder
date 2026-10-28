/** The view a browser session recorded for a Track. */
export type SessionView = {
  viewId: string;
  /** Whether a signed-in User is on the view (recorded or attached). */
  attached: boolean;
  clickId?: string;
};

/** What a visit to the Track page has to send, if anything. */
export type ViewAction = 'record' | 'attach' | 'none';

const keyOf = (trackId: string) => `vozzify:track-view:${trackId}`;

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

/**
 * The browser's session storage, or undefined where it is blocked (private
 * windows, site data off): the page then records a view per visit, which only
 * over-counts a visitor who cannot be remembered.
 */
export function sessionStorageOrUndefined(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

const isStoredView = (value: unknown): value is SessionView =>
  typeof value === 'object' &&
  value !== null &&
  'viewId' in value &&
  typeof value.viewId === 'string' &&
  value.viewId !== '' &&
  'attached' in value &&
  typeof value.attached === 'boolean';

/** The Track's view of this session, or undefined when none was recorded. */
export function readStoredView(
  storage: ReadableStorage | undefined,
  trackId: string,
): SessionView | undefined {
  try {
    const raw = storage?.getItem(keyOf(trackId));
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    return isStoredView(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function writeStoredView(
  storage: WritableStorage | undefined,
  trackId: string,
  view: SessionView,
): void {
  try {
    storage?.setItem(keyOf(trackId), JSON.stringify(view));
  } catch {
    // Storage full or blocked: the view just is not remembered.
  }
}

/**
 * A visit records a view once per session; a User who signed in after it
 * (the stored view has no User) is attached to that view instead of
 * recording another.
 */
export function nextViewAction(
  stored: SessionView | undefined,
  signedIn: boolean,
  clickId?: string,
): ViewAction {
  if (clickId !== undefined && stored?.clickId !== clickId) return 'record';
  if (stored === undefined) return 'record';
  return signedIn && !stored.attached ? 'attach' : 'none';
}
