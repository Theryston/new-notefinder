import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@notefinder/contracts';
import { currentUserFromContext } from '../decorators/current-user.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { AppException } from '../errors/app-exception.js';

/**
 * Enforces `@Roles(...)`. Runs after the global `AuthGuard`, which resolved
 * the user (if any).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) {
      return true;
    }
    const user = currentUserFromContext(context);
    if (!user) {
      throw new AppException('UNAUTHORIZED', 'Authentication required');
    }
    if (!roles.some((role) => role === user.role)) {
      throw new AppException('FORBIDDEN', 'Insufficient role');
    }
    return true;
  }
}
