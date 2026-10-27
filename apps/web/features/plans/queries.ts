import 'server-only';

import {
  cacheTags,
  type Locale,
  planCatalogSchema,
} from '@notefinder/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { serverApi } from '@/lib/api/server';

/** Public catalog only: no cookies or per-User subscription state enter this cache. */
export async function getPlanCatalog(locale: Locale) {
  'use cache';
  cacheTag(cacheTags.plans, cacheTags.planCatalog(locale));
  cacheLife('max');
  return serverApi('/plans', { schema: planCatalogSchema, query: { locale } });
}
