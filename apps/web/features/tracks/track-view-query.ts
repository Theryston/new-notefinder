import { type Locale, trackViewSchema } from '@notefinder/contracts';

import { browserApi } from '@/lib/api/browser';

/**
 * Records the visit (`POST /v1/tracks/:trackId/views`), or with the ID of the
 * session's view attaches the signed-in User to it. Answers the view's ID. The
 * locale is the one the page is displayed in; it only matters for a new view.
 */
export async function postTrackView(
  trackId: string,
  viewId: string | undefined,
  locale?: Locale,
): Promise<string> {
  const view = await browserApi(
    `/tracks/${encodeURIComponent(trackId)}/views`,
    {
      method: 'POST',
      body: {
        ...(viewId === undefined ? {} : { viewId }),
        ...(locale === undefined ? {} : { locale }),
      },
      schema: trackViewSchema,
    },
  );
  return view.viewId;
}
