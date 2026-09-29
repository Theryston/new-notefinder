'use client';

import type { ComponentProps, ReactElement, ReactNode } from 'react';

import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

/**
 * Bottom sheet with the header menu on small screens: easier to reach with
 * a thumb than a dropdown, and roomy enough for the preferences.
 */
export function MenuDrawer({
  trigger,
  title,
  children,
}: {
  trigger: ReactElement;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <Drawer showSwipeHandle>
      <DrawerTrigger render={trigger} />
      <DrawerContent className="rounded-t-2xl shadow-xl">
        <div className="flex flex-col gap-6 overflow-y-auto px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Class for a row (link or button) in a `MenuDrawer`. */
export function menuDrawerItemClassName(className?: string) {
  return cn(
    'flex h-12 w-full items-center gap-3 rounded-xl px-3 font-medium text-base outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
    className,
  );
}

/** A group of rows in a `MenuDrawer`. */
export function MenuDrawerList(props: ComponentProps<'ul'>) {
  return (
    <ul {...props} className={cn('-mx-1 flex flex-col', props.className)} />
  );
}
