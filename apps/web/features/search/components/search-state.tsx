import type { ReactNode } from 'react';

/**
 * Shared shell for the search states (prompt, empty, error): a short,
 * centered moment with an icon, a title and a description, plus an
 * optional action (the error retry).
 */
export function SearchState({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-prose flex-col items-center gap-1 py-16 text-center">
      {icon}
      <h2 className="font-bold text-xl tracking-tight">{title}</h2>
      <p className="text-muted-foreground text-xs">{description}</p>
      {children}
    </div>
  );
}
