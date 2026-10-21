'use client';

import { useQuery } from '@tanstack/react-query';

import { adminPinsQueryOptions } from '../admin-pins-query';

/** Every editorial pin, newest first, for the admin list. */
export function useAdminPins() {
  return useQuery(adminPinsQueryOptions());
}
