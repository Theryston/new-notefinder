'use client';

import { useQuery } from '@tanstack/react-query';
import type { HomePinPreviewRequest } from '@vozzify/contracts';

import { adminPinPreviewQueryOptions } from '../admin-pins-query';

/** The complete preview feed for this draft and its selected targeting. */
export function useAdminPinPreview(
  request: HomePinPreviewRequest,
  enabled: boolean,
) {
  return useQuery(adminPinPreviewQueryOptions(request, enabled));
}
