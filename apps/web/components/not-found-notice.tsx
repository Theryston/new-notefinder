/**
 * The translated body of a 404 for one entity (an artist, a Profile): a
 * heading and an explanation, centered under the site header.
 */
export function NotFoundNotice({
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
