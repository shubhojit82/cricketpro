import { Reflector } from '@nestjs/core';
import { RbacGuard } from './rbac.guard';
import { RoleName } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { SCOPE_KEY } from './scope.decorator';

describe('RbacGuard', () => {
  let guard: RbacGuard;
  let reflector: jest.Mocked<Reflector>;
  let tenantContext: { getTenantId: jest.Mock };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    tenantContext = {
      getTenantId: jest.fn(),
    };

    guard = new RbacGuard(reflector, tenantContext as any);
  });

  function createContext(user?: unknown) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  }

  it('allows access when role is allowed', () => {
    reflector.getAllAndOverride.mockImplementation(
      (metadataKey: unknown) => {
        if (metadataKey === ROLES_KEY) {
          return [RoleName.TOURNAMENT_ADMIN];
        }
        return undefined;
      },
    );

    const context = createContext({
      id: 'user-1',
      roles: [RoleName.TOURNAMENT_ADMIN],
      permissions: [],
      tenantId: 'tenant-1',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access when role is not included', () => {
    reflector.getAllAndOverride.mockImplementation(
      (metadataKey: unknown) => {
        if (metadataKey === ROLES_KEY) {
          return [RoleName.UMPIRE];
        }
        return undefined;
      },
    );

    const context = createContext({
      id: 'user-2',
      roles: [RoleName.SCORER],
      permissions: [],
      tenantId: 'tenant-1',
    });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('allows SUPER_ADMIN bypass even when scope metadata is present', () => {
    reflector.getAllAndOverride.mockImplementation(
      (metadataKey: unknown) => {
        if (metadataKey === ROLES_KEY) {
          return [RoleName.UMPIRE];
        }
        if (metadataKey === SCOPE_KEY) {
          return 'tenant';
        }
        return undefined;
      },
    );

    tenantContext.getTenantId.mockReturnValue('tenant-1');

    const context = createContext({
      id: 'admin-1',
      roles: [RoleName.SUPER_ADMIN],
      permissions: [],
      tenantId: 'tenant-2',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when tenant scope matches the current tenant', () => {
    reflector.getAllAndOverride.mockImplementation(
      (metadataKey: unknown) => {
        if (metadataKey === SCOPE_KEY) {
          return 'tenant';
        }
        return undefined;
      },
    );

    tenantContext.getTenantId.mockReturnValue('tenant-1');

    const context = createContext({
      id: 'user-3',
      roles: [RoleName.SCORER],
      permissions: [],
      tenantId: 'tenant-1',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access when tenant scope does not match the current tenant', () => {
    reflector.getAllAndOverride.mockImplementation(
      (metadataKey: unknown) => {
        if (metadataKey === SCOPE_KEY) {
          return 'tenant';
        }
        return undefined;
      },
    );

    tenantContext.getTenantId.mockReturnValue('tenant-1');

    const context = createContext({
      id: 'user-4',
      roles: [RoleName.SCORER],
      permissions: [],
      tenantId: 'tenant-2',
    });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('allows access when no RBAC metadata is defined', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const context = createContext();

    expect(guard.canActivate(context)).toBe(true);
  });
});
