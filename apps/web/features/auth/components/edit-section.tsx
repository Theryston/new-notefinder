import { type ReactNode, useId } from 'react';

/** A titled block of the edit page; the title names the region for readers. */
export function EditSection({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="font-semibold text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}
