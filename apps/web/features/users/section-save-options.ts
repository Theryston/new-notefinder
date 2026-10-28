import type { QueryClient } from '@tanstack/react-query';
import type { ProfileSection, ProfileVisibility } from '@vozzify/contracts';

import { saveSectionVisibility } from './profile-visibility-query';
import { profileKeys } from './query-keys';

/** The owner's visibility strings, resolved on the server (`getSectionVisibilityLabels`). */
export type SectionVisibilityLabels = {
  visible: string;
  hidden: string;
  saved: string;
  failed: string;
};

/** Where a save says how it went: a toast, in the page's Toaster. */
export type SaveNotifier = {
  success: (message: string) => void;
  error: (message: string) => void;
};

/** The flags with one section changed, the way the API would store it. */
export function withSectionFlag(
  flags: ProfileVisibility,
  section: ProfileSection,
  visible: boolean,
): ProfileVisibility {
  return { ...flags, [section]: visible };
}

/**
 * The mutation that saves one section's flag. The change shows at once; a
 * failed save puts the stored flags back and says so, a saved one confirms.
 * Plain options, so the optimistic update and the rollback are testable
 * without rendering.
 */
export function sectionSaveOptions(
  section: ProfileSection,
  {
    queryClient,
    labels,
    notify,
  }: {
    queryClient: QueryClient;
    labels: SectionVisibilityLabels;
    notify: SaveNotifier;
  },
) {
  return {
    mutationFn: (visible: boolean) => saveSectionVisibility(section, visible),
    onMutate: async (visible: boolean) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.visibility() });
      const previous = queryClient.getQueryData<ProfileVisibility>(
        profileKeys.visibility(),
      );
      if (previous) {
        queryClient.setQueryData<ProfileVisibility>(
          profileKeys.visibility(),
          withSectionFlag(previous, section, visible),
        );
      }
      return { previous };
    },
    onError: (
      _error: unknown,
      _visible: boolean,
      context: { previous?: ProfileVisibility } | undefined,
    ) => {
      if (context?.previous) {
        queryClient.setQueryData(profileKeys.visibility(), context.previous);
      }
      notify.error(labels.failed);
    },
    onSuccess: (flags: ProfileVisibility) => {
      queryClient.setQueryData(profileKeys.visibility(), flags);
      notify.success(labels.saved);
    },
  };
}
