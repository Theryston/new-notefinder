'use client';

import type { HomePinPreviewRequest } from '@notefinder/contracts';
import { useQuery } from '@tanstack/react-query';

import { adminPinPreviewQueryOptions } from '../admin-pins-query';

/** The complete preview feed for this draft and its selected targeting. */
export function useAdminPinPreview(
  request: HomePinPreviewRequest,
  enabled: boolean,
) {
  return useQuery(adminPinPreviewQueryOptions(request, enabled));
}
