import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@notefinder/contracts';

export const ROLES_KEY = Symbol('ROLES');

/**
 * Restricts a route (or controller) to users with one of these roles:
 * `@Roles('ADMIN')`. Signed-out requests get `UNAUTHORIZED`, other roles
 * `FORBIDDEN`.
 */
export const Roles = (...roles: [UserRole, ...UserRole[]]) =>
  SetMetadata(ROLES_KEY, roles);
