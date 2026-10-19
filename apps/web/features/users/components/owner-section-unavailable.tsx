import type { ProfileSection } from '@notefinder/contracts';
import { getTranslations } from 'next-intl/server';

import { getSectionVisibilityLabels } from '../section-visibility-labels';
import {
  ProfileSectionScope,
  SectionVisibilityToggle,
} from './profile-section-scope';

/**
 * What the owner sees for a section whose read failed: its title, its toggle
 * and a notice, so a failed read never looks like a section the owner hid.
 */
export async function OwnerSectionUnavailable({
  username,
  section,
  title,
}: {
  username: string;
  section: ProfileSection;
  title: string;
}) {
  const [t, labels] = await Promise.all([
    getTranslations('publicProfile.visibility'),
    getSectionVisibilityLabels(),
  ]);

  return (
    <ProfileSectionScope username={username} section={section} labels={labels}>
      <section aria-label={title} className="flex flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-xl">{title}</h2>
          <SectionVisibilityToggle />
        </header>
        <p role="alert" className="text-muted-foreground text-sm">
          {t('ownerUnavailable')}
        </p>
      </section>
    </ProfileSectionScope>
  );
}
