'use client';

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

import { SegmentedControl } from './segmented-control';

const themes = [
  { value: 'light', icon: SunIcon },
  { value: 'system', icon: MonitorIcon },
  { value: 'dark', icon: MoonIcon },
] as const;

const noSubscription = () => () => {};

/**
 * The theme as an icon-only segmented control (the header from `md`, the
 * footer below it). The server
 * can't know the stored theme, so nothing is pressed until the page
 * hydrates.
 */
export function ThemeToggle() {
  const t = useTranslations('header.preferences');
  const { theme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  return (
    <SegmentedControl
      label={t('theme')}
      value={hydrated ? (theme ?? 'system') : null}
      onChange={setTheme}
      className="gap-3.5"
      buttonClassName="px-2"
      options={themes.map(({ value, icon: Icon }) => ({
        value,
        label: t(`themes.${value}`),
        content: <Icon className="size-4" />,
      }))}
    />
  );
}
