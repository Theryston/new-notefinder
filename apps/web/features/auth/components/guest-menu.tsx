'use client';

import { EllipsisIcon, FileTextIcon, MenuIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  MenuDrawer,
  MenuDrawerList,
  menuDrawerItemClassName,
} from '@/components/menu-drawer';
import {
  menuItemClassName,
  menuSurfaceClassName,
} from '@/components/menu-styles';
import {
  PreferencesPanel,
  PreferencesSubmenus,
} from '@/components/preferences';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

import type { AuthHref } from '../redirect-to';

/**
 * A visitor's menu (preferences and terms): a dropdown from `md` up; below
 * that, a bottom sheet that also holds "Sign up".
 */
export function GuestMenu({ signUp }: { signUp: AuthHref }) {
  const t = useTranslations('header');

  return (
    <>
      <div className="hidden md:block">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('account.menu')}
              />
            }
          >
            <EllipsisIcon className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className={menuSurfaceClassName}
          >
            <PreferencesSubmenus />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={menuItemClassName}
              render={<Link href="/terms" />}
            >
              <FileTextIcon />
              {t('preferences.terms')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="md:hidden">
        <MenuDrawer
          title={t('account.menu')}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t('account.menu')}>
              <MenuIcon className="size-5" />
            </Button>
          }
        >
          <Link
            href={signUp}
            className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
          >
            {t('account.signUp')}
          </Link>
          <PreferencesPanel />
          <MenuDrawerList>
            <li>
              <Link href="/terms" className={menuDrawerItemClassName()}>
                <FileTextIcon />
                {t('preferences.terms')}
              </Link>
            </li>
          </MenuDrawerList>
        </MenuDrawer>
      </div>
    </>
  );
}
