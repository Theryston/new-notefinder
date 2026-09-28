import type { FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

export type LazyResolver<T extends FieldValues> = Resolver<T> & {
  /** Loads Zod and the resolver now (call it once the form is on screen). */
  preload: () => Promise<Resolver<T>>;
};

/**
 * A react-hook-form resolver for a contracts schema that loads Zod (through
 * the schema) and the Zod resolver on demand, so they stay out of the page's
 * first-load JavaScript. Create it once per form (module scope) and
 * `preload()` it after mount: while it is still loading, validation is slow
 * enough for a field's blur validation to finish after a submit and
 * overwrite its errors.
 */
export function lazyResolver<T extends FieldValues>(
  loadSchema: () => Promise<z.ZodType<T, T>>,
): LazyResolver<T> {
  let loading: Promise<Resolver<T>> | undefined;

  const preload = () => {
    loading ??= Promise.all([
      import('@hookform/resolvers/zod'),
      loadSchema(),
    ]).then(
      ([{ zodResolver }, schema]): Resolver<T> => zodResolver(schema),
      (error: unknown) => {
        // A failed chunk load is retried on the next validation.
        loading = undefined;
        throw error;
      },
    );
    return loading;
  };

  const resolver: Resolver<T> = async (values, context, options) =>
    (await preload())(values, context, options);

  return Object.assign(resolver, { preload });
}
