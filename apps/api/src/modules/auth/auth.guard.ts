import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../common/decorators/current-user.decorator.js';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { AppException } from '../../common/errors/app-exception.js';
import { AUTH } from './auth.constants.js';
import type { Auth } from './auth.js';

/**
 * Global guard (registered after the throttler, so floods are rejected
 * before any session lookup). Resolves the Better Auth session from the
 * request cookie and exposes it to `@CurrentUser()`. Routes are private by
 * default: without a valid session they get the `UNAUTHORIZED` envelope,
 * unless marked `@Public()`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const isPublic =
      this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();

    let session: Awaited<ReturnType<AuthGuard['resolveSession']>>;
    try {
      session = await this.resolveSession(request, http.getResponse());
    } catch (error) {
      // A public page must keep working when the session store is down.
      if (!isPublic) throw error;
      this.logger.warn(
        `Session lookup failed on a public route: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      session = null;
    }

    if (session) {
      request.user = session.user;
      request.authSession = session.session;
      return true;
    }
    if (isPublic) {
      return true;
    }
    throw new AppException('UNAUTHORIZED', 'Authentication required');
  }

  private async resolveSession(
    request: AuthenticatedRequest,
    response: Response,
  ) {
    const { headers, response: session } = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
      returnHeaders: true,
    });
    // Better Auth refreshes the session (and its cookie) once `updateAge`
    // has passed; forward the new cookie so it doesn't expire early.
    const setCookie = headers.getSetCookie();
    if (setCookie.length > 0) {
      response.append('Set-Cookie', setCookie);
    }
    return session;
  }
}
