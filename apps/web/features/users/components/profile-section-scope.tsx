'use client';

import type { ProfileSection } from '@notefinder/contracts';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { createContext, type ReactNode, useContext } from 'react';

import { Button } from '@/components/ui/button';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { cn } from '@/lib/utils';

import {
  type SectionControl,
  type SectionVisibilityLabels,
  useSectionVisibility,
} from '../hooks/use-section-visibility';

export type { SectionVisibilityLabels } from '../hooks/use-section-visibility';

type SectionScope = {
  labels: SectionVisibilityLabels;
  /** The owner's toggle, once their flags are known; `null` for visitors. */
  control: SectionControl | null;
};

const SectionScopeContext = createContext<SectionScope | null>(null);

/**
 * Wraps one section of a Profile. For the owner it holds the section's flag,
 * read in the browser, and dims the section while it is hidden; visitors see
 * the section as the server rendered it. `hiddenForVisitors` is set when the
 * server rendered a section only its owner can see, so the owner sees the
 * dimmed state before the flags load.
 */
export function ProfileSectionScope({
  username,
  section,
  hiddenForVisitors = false,
  labels,
  children,
}: {
  username: string;
  section: ProfileSection;
  hiddenForVisitors?: boolean;
  labels: SectionVisibilityLabels;
  children: ReactNode;
}) {
  return (
    <SessionUserBoundary
      render={(user) => (
        <SectionScopeProvider
          owner={user?.username === username}
          section={section}
          hiddenForVisitors={hiddenForVisitors}
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
  hiddenForVisitors,
  labels,
  children,
}: {
  owner: boolean;
  section: ProfileSection;
  hiddenForVisitors: boolean;
  labels: SectionVisibilityLabels;
  children: ReactNode;
}) {
  const { visible, control } = useSectionVisibility({
    section,
    owner,
    hiddenForVisitors,
    labels,
  });

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
