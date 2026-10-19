'use client';

import type { ProfileSection, ProfileVisibility } from '@notefinder/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { createContext, type ReactNode, useContext } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { cn } from '@/lib/utils';

import {
  profileVisibilityQueryOptions,
  saveSectionVisibility,
} from '../profile-visibility-query';
import { profileKeys } from '../query-keys';

export type SectionVisibilityLabels = {
  visible: string;
  hidden: string;
  saved: string;
  failed: string;
};

type SectionControl = { visible: boolean; save: (visible: boolean) => void };

type SectionScope = {
  labels: SectionVisibilityLabels;
  /** The owner's toggle, once their flags are known; `null` for visitors. */
  control: SectionControl | null;
};

const SectionScopeContext = createContext<SectionScope | null>(null);

/**
 * Wraps one section of a Profile. For the owner it holds the section's flag,
 * read in the browser, and dims the section while it is hidden; visitors see
 * the section as the server rendered it. `hiddenOnServer` is what the server
 * knew when it rendered a section only the owner can see, so the owner sees
 * the dimmed state before the flags load.
 */
export function ProfileSectionScope({
  username,
  section,
  hiddenOnServer = false,
  labels,
  children,
}: {
  username: string;
  section: ProfileSection;
  hiddenOnServer?: boolean;
  labels: SectionVisibilityLabels;
  children: ReactNode;
}) {
  return (
    <SessionUserBoundary
      render={(user) => (
        <SectionScopeProvider
          owner={user?.username === username}
          section={section}
          hiddenOnServer={hiddenOnServer}
          labels={labels}
        >
          {children}
        </SectionScopeProvider>
      )}
    />
  );
}

function SectionScopeProvider({
  owner,
  section,
  hiddenOnServer,
  labels,
  children,
}: {
  owner: boolean;
  section: ProfileSection;
  hiddenOnServer: boolean;
  labels: SectionVisibilityLabels;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const flags = useQuery({
    ...profileVisibilityQueryOptions(),
    enabled: owner,
  });
  const save = useMutation({
    mutationFn: (visible: boolean) => saveSectionVisibility(section, visible),
    // The change shows at once; a failed save puts the stored flags back.
    onMutate: async (visible) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.visibility() });
      const previous = queryClient.getQueryData<ProfileVisibility>(
        profileKeys.visibility(),
      );
      if (previous) {
        queryClient.setQueryData<ProfileVisibility>(profileKeys.visibility(), {
          ...previous,
          [section]: visible,
        });
      }
      return { previous };
    },
    onError: (_error, _visible, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profileKeys.visibility(), context.previous);
      }
      toast.error(labels.failed);
    },
    onSuccess: (flagsNow) => {
      queryClient.setQueryData(profileKeys.visibility(), flagsNow);
      toast.success(labels.saved);
    },
  });

  const visible = owner && flags.data ? flags.data[section] : !hiddenOnServer;
  const control =
    owner && flags.data
      ? { visible, save: (next: boolean) => save.mutate(next) }
      : null;

  return (
    <SectionScopeContext value={{ labels, control }}>
      <div
        data-section={section}
        data-visible={visible}
        className={cn(!visible && 'opacity-60')}
      >
        {children}
      </div>
    </SectionScopeContext>
  );
}

/**
 * The pill that shows and hides the section, for its owner. Rendered in the
 * section's title row; nothing shows for visitors.
 */
export function SectionVisibilityToggle() {
  const scope = useContext(SectionScopeContext);
  if (!scope?.control) return null;
  const { visible, save } = scope.control;
  const Icon = visible ? EyeIcon : EyeOffIcon;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={visible}
      className="rounded-full"
      onClick={() => save(!visible)}
    >
      <Icon aria-hidden="true" />
      {visible ? scope.labels.visible : scope.labels.hidden}
    </Button>
  );
}
