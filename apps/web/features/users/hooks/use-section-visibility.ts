'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProfileSection, ProfileVisibility } from '@vozzify/contracts';
import { toast } from 'sonner';

import { profileVisibilityQueryOptions } from '../profile-visibility-query';
import {
  type SectionVisibilityLabels,
  sectionSaveOptions,
} from '../section-save-options';

export type { SectionVisibilityLabels };

/** What the owner's toggle needs: the state shown, and how to change it. */
export type SectionControl = {
  visible: boolean;
  save: (visible: boolean) => void;
};

/**
 * The shown state of one section for its owner, and the toggle that changes
 * it. The owner's flags are read in the browser; until they load, the section
 * shows as the server rendered it (`hiddenForVisitors`), and there is no
 * toggle yet. Visitors (`owner` false) never read the flags.
 */
export function useSectionVisibility({
  section,
  owner,
  hiddenForVisitors,
  labels,
}: {
  section: ProfileSection;
  owner: boolean;
  hiddenForVisitors: boolean;
  labels: SectionVisibilityLabels;
}): { visible: boolean; control: SectionControl | null } {
  const queryClient = useQueryClient();
  const flags = useQuery({
    ...profileVisibilityQueryOptions(),
    enabled: owner,
  });
  const save = useMutation(
    sectionSaveOptions(section, { queryClient, labels, notify: toast }),
  );

  const visible = sectionShown({
    section,
    owner,
    hiddenForVisitors,
    flags: flags.data,
  });
  const control =
    owner && flags.data
      ? { visible, save: (next: boolean) => save.mutate(next) }
      : null;
  return { visible, control };
}

/**
 * Whether a section is shown: the owner's flag once it is known, else what the
 * server rendered. A visitor, or an owner whose flags have not loaded, sees the
 * section as the server laid it out.
 */
export function sectionShown({
  section,
  owner,
  hiddenForVisitors,
  flags,
}: {
  section: ProfileSection;
  owner: boolean;
  hiddenForVisitors: boolean;
  flags: ProfileVisibility | undefined;
}): boolean {
  return owner && flags ? flags[section] : !hiddenForVisitors;
}
