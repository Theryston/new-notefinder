'use client';

import {
  type LucideIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  SunMoonIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { isLocale, routing } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils';

import { menuItemClassName, menuSurfaceClassName } from './menu-styles';

const themes = [
  { value: 'light', icon: SunIcon },
  { value: 'dark', icon: MoonIcon },
  { value: 'system', icon: MonitorIcon },
] as const;

/** Current theme and language, and how to change them. */
function usePreferences() {
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return {
    theme: theme ?? 'system',
    setTheme,
    locale,
    // Same page and query in the other locale; next-intl remembers the
    // choice in the locale cookie that `proxy.ts` reads.
    setLocale: (next: string) => {
      if (!isLocale(next) || next === locale) return;
      router.replace(`${pathname}${window.location.search}`, { locale: next });
    },
  };
}

/** Theme and language submenus for a dropdown menu. */
export function PreferencesSubmenus() {
  const t = useTranslations('header.preferences');
  const { theme, setTheme, locale, setLocale } = usePreferences();

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className={menuItemClassName}>
          <SunMoonIcon />
          {t('theme')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className={menuSurfaceClassName}>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value: string) => setTheme(value)}
          >
            {themes.map(({ value, icon: Icon }) => (
              <DropdownMenuRadioItem
                key={value}
                value={value}
                className={cn(menuItemClassName, 'pr-9')}
              >
                <Icon />
                {t(`themes.${value}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className={menuItemClassName}>
          <span aria-hidden="true" className="w-4 text-center font-semibold">
            {locale === 'en' ? 'EN' : 'PT'}
          </span>
          {t('language')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className={menuSurfaceClassName}>
          <DropdownMenuRadioGroup
            value={locale}
            onValueChange={(value: string) => setLocale(value)}
          >
            {routing.locales.map((value) => (
              <DropdownMenuRadioItem
                key={value}
                value={value}
                lang={value}
                className={cn(menuItemClassName, 'pr-9')}
              >
                {t(`languages.${value}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
}

type Option = { value: string; label: string; icon?: LucideIcon };

/** A pill segmented control: one toggle button per option. */
function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-medium text-muted-foreground text-xs">
        {label}
      </legend>
      <div className="flex gap-1 rounded-full bg-foreground/5 p-1">
        {options.map(({ value: option, label: text, icon: Icon }) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            onClick={() => onChange(option)}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full font-medium text-muted-foreground text-sm outline-none transition-colors duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
          >
            {Icon ? <Icon className="size-4" /> : null}
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Theme and language as segmented controls, for a drawer. */
export function PreferencesPanel() {
  const t = useTranslations('header.preferences');
  const { theme, setTheme, locale, setLocale } = usePreferences();

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label={t('theme')}
        value={theme}
        onChange={setTheme}
        options={themes.map(({ value, icon }) => ({
          value,
          icon,
          label: t(`themes.${value}`),
        }))}
      />
      <Segmented
        label={t('language')}
        value={locale}
        onChange={setLocale}
        options={routing.locales.map((value) => ({
          value,
          label: t(`languages.${value}`),
        }))}
      />
    </div>
  );
}
