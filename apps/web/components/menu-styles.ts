// DESIGN.md "Menus, popovers, toasts", applied over the generated shadcn
// menu so its internals stay as generated.

/** Glass menu surface: `rounded-xl` with 4px padding. */
export const menuSurfaceClassName =
  'glass min-w-48 rounded-xl p-1 text-foreground ring-0';

/** Menu item: `rounded-lg` (concentric with the surface), 16px icon. */
export const menuItemClassName =
  'gap-2.5 rounded-lg px-3 py-2 font-medium focus:bg-foreground/10 data-popup-open:bg-foreground/10 data-open:bg-foreground/10 [&_svg]:text-muted-foreground';
