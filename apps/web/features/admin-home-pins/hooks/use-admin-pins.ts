'use client';

import { useQuery } from '@tanstack/react-query';

import {
  adminPinMetricsQueryOptions,
  adminPinsQueryOptions,
} from '../admin-pins-query';

/** Every editorial pin, newest first, for the admin list. */
export function useAdminPins() {
  return useQuery(adminPinsQueryOptions());
}

/** Persisted impression, click and click-through totals for the pin cards. */
export function useAdminPinMetrics() {
  return useQuery(adminPinMetricsQueryOptions());
}
