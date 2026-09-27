import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AppException } from '../../common/errors/app-exception.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AUTH } from './auth.constants.js';
import { AuthGuard } from './auth.guard.js';

class PrivateController {
  handler() {}
  @Public()
  publicHandler() {}
  @Roles('ADMIN')
  adminHandler() {}
}

@Public()
class PublicController {
  handler() {}
}

type FakeRequest = { headers: Record<string, string>; user?: unknown };

const createContext = (
  controller: new () => object,
  handlerName: string,
  request: FakeRequest,
  response = { append: vi.fn() },
): ExecutionContext => {
  const handler: unknown = Reflect.get(controller.prototype, handlerName);
  return {
    getType: () => 'http',
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
};

const user = { id: 'u1', role: 'USER', email: 'ana@example.com' };
const session = { id: 's1', userId: 'u1', token: 't' };

describe('AuthGuard', () => {
  let guard: AuthGuard;
  const getSession = vi.fn();

  beforeEach(async () => {
    getSession.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthGuard,
        Reflector,
        { provide: AUTH, useValue: { api: { getSession } } },
      ],
    }).compile();
    guard = moduleRef.get(AuthGuard);
  });

  const withSession = (value: unknown, setCookie: string[] = []) => {
    const headers = new Headers();
    for (const cookie of setCookie) headers.append('set-cookie', cookie);
    getSession.mockResolvedValue({ headers, response: value });
  };

  it('rejects private routes without a session with UNAUTHORIZED', async () => {
    withSession(null);
    const context = createContext(PrivateController, 'handler', {
      headers: {},
    });

    const result = guard.canActivate(context);
    await expect(result).rejects.toBeInstanceOf(AppException);
    await expect(result).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('attaches the user and session on private routes', async () => {
    withSession({ user, session });
    const request: FakeRequest = { headers: { cookie: 'notefinder.x=1' } };
    const context = createContext(PrivateController, 'handler', request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toMatchObject({ user, authSession: session });
    const [{ headers }] = getSession.mock.lastCall ?? [];
    expect(headers.get('cookie')).toBe('notefinder.x=1');
  });

  it('forwards a refreshed session cookie', async () => {
    withSession({ user, session }, ['notefinder.session_token=new; Path=/']);
    const response = { append: vi.fn() };
    const context = createContext(
      PrivateController,
      'handler',
      { headers: {} },
      response,
    );

    await guard.canActivate(context);
    expect(response.append).toHaveBeenCalledWith('Set-Cookie', [
      'notefinder.session_token=new; Path=/',
    ]);
  });

  it.each([
    ['a @Public() handler', PrivateController, 'publicHandler'],
    ['a @Public() controller', PublicController, 'handler'],
  ])('lets signed-out requests through %s', async (_, controller, name) => {
    withSession(null);
    const request: FakeRequest = { headers: {} };
    await expect(
      guard.canActivate(createContext(controller, name, request)),
    ).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('still resolves the user on public routes', async () => {
    withSession({ user, session });
    const request: FakeRequest = { headers: {} };
    await guard.canActivate(
      createContext(PublicController, 'handler', request),
    );
    expect(request.user).toEqual(user);
  });

  it('keeps public routes working when the session lookup fails', async () => {
    getSession.mockRejectedValue(new Error('db down'));
    await expect(
      guard.canActivate(
        createContext(PublicController, 'handler', { headers: {} }),
      ),
    ).resolves.toBe(true);
  });

  it('propagates session lookup failures on private routes', async () => {
    getSession.mockRejectedValue(new Error('db down'));
    await expect(
      guard.canActivate(
        createContext(PrivateController, 'handler', { headers: {} }),
      ),
    ).rejects.toThrow('db down');
  });

  it('ignores non-HTTP contexts', async () => {
    const context = { getType: () => 'rpc' } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(getSession).not.toHaveBeenCalled();
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows routes without @Roles()', () => {
    const context = createContext(PrivateController, 'handler', {
      headers: {},
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows users with a required role', () => {
    const context = createContext(PrivateController, 'adminHandler', {
      headers: {},
      user: { ...user, role: 'ADMIN' },
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects other roles with FORBIDDEN', () => {
    const context = createContext(PrivateController, 'adminHandler', {
      headers: {},
      user,
    });
    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('rejects signed-out requests with UNAUTHORIZED', () => {
    const context = createContext(PrivateController, 'adminHandler', {
      headers: {},
    });
    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });
});
