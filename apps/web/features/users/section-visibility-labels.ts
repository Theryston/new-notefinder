import 'server-only';

import { getTranslations } from 'next-intl/server';

import type { SectionVisibilityLabels } from './section-save-options';

/** The owner's visibility strings, resolved on the server for the client toggle. */
export async function getSectionVisibilityLabels(): Promise<SectionVisibilityLabels> {
  const t = await getTranslations('publicProfile.visibility');
  return {
    visible: t('visible'),
    hidden: t('hidden'),
    saved: t('saved'),
    failed: t('failed'),
  };
}
