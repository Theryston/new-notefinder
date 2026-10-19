/**
 * A translated heading and explanation for one entity (an artist or a
 * Profile) that is missing or cannot be loaded, centered under the header.
 */
export function NoticeMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <h1 className="font-bold text-2xl tracking-tight">{title}</h1>
      <p className="max-w-prose text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
