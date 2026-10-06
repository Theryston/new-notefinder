// DESIGN.md "Menus, popovers, toasts", applied over the generated shadcn
// menu so its internals stay as generated. The base `dropdown-menu.tsx`
// already renders glass; these classes keep feature code explicit and guard
// against regressions if the generated file is refreshed.

/** Glass menu surface: `rounded-xl` with 4px padding. */
export const menuSurfaceClassName =
  'glass min-w-48 rounded-xl p-1 text-foreground';

/** Menu item: `rounded-lg` (concentric with the surface), 16px icon. */
export const menuItemClassName =
  'gap-2.5 rounded-lg px-3 py-2 text-sm font-medium focus:bg-foreground/10 data-highlighted:bg-foreground/10 data-popup-open:bg-foreground/10 data-open:bg-foreground/10 [&_svg]:size-4 [&_svg]:text-muted-foreground';
