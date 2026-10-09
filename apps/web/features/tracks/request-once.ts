/**
 * Which Recordings this tab has already asked for through a search marker.
 *
 * The marker stays in the history of the sign-in steps, so going back through
 * them, or reloading one, brings it back on a page that would request again.
 * The mark stops that: a Recording the tab requested is not requested again.
 * It lives in the tab's sessionStorage, and it is only a convenience: a repeat
 * request for a Recording that has a Track is answered with that Track and
 * writes nothing. Storage the browser refuses reads as "no mark".
 */

/** The part of the storage the marks use. */
export type RequestMarks = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const MARK_VALUE = 'requested';

const markKey = (recordingMbid: string): string =>
  `notefinder.track-request.${recordingMbid}`;

/** This tab's marks, or `undefined` when the browser refuses its session storage. */
export function tabRequestMarks(): RequestMarks | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** Whether this tab already requested the Track of `recordingMbid`. */
export function hasRequested(
  marks: RequestMarks | undefined,
  recordingMbid: string,
): boolean {
  try {
    return marks?.getItem(markKey(recordingMbid)) === MARK_VALUE;
  } catch {
    return false;
  }
}

/** Marks `recordingMbid` as requested by this tab. */
export function markRequested(
  marks: RequestMarks | undefined,
  recordingMbid: string,
): void {
  try {
    marks?.setItem(markKey(recordingMbid), MARK_VALUE);
  } catch {
    return;
  }
}

/** Forgets the mark, so a request that failed can be made again. */
export function unmarkRequested(
  marks: RequestMarks | undefined,
  recordingMbid: string,
): void {
  try {
    marks?.removeItem(markKey(recordingMbid));
  } catch {
    return;
  }
}
