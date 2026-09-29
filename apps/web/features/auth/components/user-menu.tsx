'use client';

import {
  FileTextIcon,
  LogOutIcon,
  type LucideIcon,
  PencilIcon,
  UserIcon,
} from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/lib/i18n/navigation';

import { initials } from '../initials';
import type { SessionUser } from '../session';
import { useSignOut } from './sign-out';

type MenuLink = { href: string; label: string; icon: LucideIcon };

function useMenuLinks(user: SessionUser): MenuLink[] {
  const t = useTranslations('header');
  const profile: MenuLink[] = user.username
    ? [
        {
          href: `/users/${user.username}`,
          label: t('account.myProfile'),
          icon: UserIcon,
        },
      ]
    : [];
  return [
    ...profile,
    { href: '/me/edit', label: t('account.editProfile'), icon: PencilIcon },
  ];
}

function UserAvatar({ user }: { user: SessionUser }) {
  return (
    <Avatar className="size-9">
      {user.image ? (
        // Decorative: the name is next to it or on the button. Google's photo
        // host refuses some requests that carry a referrer.
        <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback className="bg-primary/15 font-semibold text-primary">
        {initials(user.name, user.username ?? user.email)}
      </AvatarFallback>
    </Avatar>
  );
}

function UserSummary({ user }: { user: SessionUser }) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-3 py-2">
      <UserAvatar user={user} />
      <div className="min-w-0">
        <p className="truncate font-semibold text-sm">
          {user.name || user.username}
        </p>
        {user.username ? (
          <p className="truncate text-muted-foreground text-xs">
            @{user.username}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type Props = { user: SessionUser; currentPath: string };

/** The signed-in user's menu: a dropdown from `md` up. */
function UserDropdown({ user, currentPath }: Props) {
  const t = useTranslations('header');
  const links = useMenuLinks(user);
  const { signOut, pending } = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('account.accountMenu')}
          />
        }
      >
        <UserAvatar user={user} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className={menuSurfaceClassName}
      >
        <UserSummary user={user} />
        <DropdownMenuSeparator />
        {links.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem
            key={href}
            className={menuItemClassName}
            render={<Link href={href} />}
          >
            <Icon />
            {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <PreferencesSubmenus />
        <DropdownMenuItem
          className={menuItemClassName}
          render={<Link href="/terms" />}
        >
          <FileTextIcon />
          {t('preferences.terms')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={menuItemClassName}
          disabled={pending}
          onClick={() => signOut(currentPath)}
        >
          <LogOutIcon />
          {t('account.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The same menu as a bottom sheet, below `md`. */
function UserDrawer({ user, currentPath }: Props) {
  const t = useTranslations('header');
  const links = useMenuLinks(user);
  const { signOut, pending } = useSignOut();

  return (
    <MenuDrawer
      title={t('account.accountMenu')}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('account.accountMenu')}
        >
          <UserAvatar user={user} />
        </Button>
      }
    >
      <UserSummary user={user} />
      <MenuDrawerList>
        {links.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className={menuDrawerItemClassName()}>
              <Icon />
              {label}
            </Link>
          </li>
        ))}
      </MenuDrawerList>
      <PreferencesPanel />
      <MenuDrawerList>
        <li>
          <Link href="/terms" className={menuDrawerItemClassName()}>
            <FileTextIcon />
            {t('preferences.terms')}
          </Link>
        </li>
        <li>
          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            onClick={() => signOut(currentPath)}
            className={menuDrawerItemClassName()}
          >
            <LogOutIcon />
            {t('account.signOut')}
          </button>
        </li>
      </MenuDrawerList>
    </MenuDrawer>
  );
}

/** Avatar button opening the signed-in user's menu. */
export function UserMenu(props: Props) {
  return (
    <>
      <div className="hidden md:block">
        <UserDropdown {...props} />
      </div>
      <div className="md:hidden">
        <UserDrawer {...props} />
      </div>
    </>
  );
}
