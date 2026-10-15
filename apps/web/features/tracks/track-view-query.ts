import { trackViewSchema } from '@notefinder/contracts';

import { browserApi } from '@/lib/api/browser';

/**
 * Records the visit (`POST /v1/tracks/:trackId/views`), or with the ID of the
 * session's view attaches the signed-in User to it. Answers the view's ID.
 */
export async function postTrackView(
  trackId: string,
  viewId: string | undefined,
): Promise<string> {
  const view = await browserApi(
    `/tracks/${encodeURIComponent(trackId)}/views`,
    {
      method: 'POST',
      body: viewId === undefined ? {} : { viewId },
      schema: trackViewSchema,
    },
  );
  return view.viewId;
}
