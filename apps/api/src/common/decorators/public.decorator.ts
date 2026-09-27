import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = Symbol('IS_PUBLIC');

/**
 * Opts a route (or a whole controller) out of authentication. Routes are
 * private by default. A signed-in user is still resolved on public routes,
 * so `@CurrentUser()` works there (it may be `undefined`).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
