import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../src/common/decorators/current-user.decorator.js';
import { Public } from '../src/common/decorators/public.decorator.js';
import { Roles } from '../src/common/decorators/roles.decorator.js';
import type { AuthUser } from '../src/modules/auth/auth.js';

/**
 * Test-only routes that exercise the global `AuthGuard` and `RolesGuard`
 * through `@Public()` and `@Roles()`. Mounted only by the e2e specs; it lives
 * outside `*.e2e-spec.ts` for the same reason as `e2e-probe.controller.ts`.
 */
@Controller('e2e-auth-probe')
export class AuthProbeController {
  @Public()
  @Get('public')
  getPublic(@CurrentUser() user: AuthUser | undefined) {
    return { userId: user?.id ?? null };
  }

  @Get('private')
  getPrivate(@CurrentUser() user: AuthUser) {
    return { userId: user.id };
  }

  @Roles('ADMIN')
  @Get('admin')
  getAdmin(@CurrentUser() user: AuthUser) {
    return { userId: user.id };
  }
}
