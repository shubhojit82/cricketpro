import { CanActivate, ExecutionContext, Injectable, Scope } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from '../tenant/tenant-context.service';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { ROLES_KEY } from './roles.decorator';
import { SCOPE_KEY } from './scope.decorator';
import { RoleName as PrismaRoleName } from '@prisma/client';
import type { RbacScope, RbacUserContext } from './rbac.types';

@Injectable({ scope: Scope.REQUEST })
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<PrismaRoleName[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const requiredScope =
      this.reflector.getAllAndOverride<RbacScope>(SCOPE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    if (
      requiredRoles.length === 0 &&
      requiredPermissions.length === 0 &&
      !requiredScope
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user as RbacUserContext | undefined;

    if (!user) {
      return false;
    }

    if (user.roles?.includes(PrismaRoleName.SUPER_ADMIN)) {
      return true;
    }

    if (
      requiredRoles.length > 0 &&
      !requiredRoles.some((role) => user.roles.includes(role))
    ) {
      return false;
    }

    if (
      requiredPermissions.length > 0 &&
      !requiredPermissions.every((permission) =>
        user.permissions.includes(permission),
      )
    ) {
      return false;
    }

    if (requiredScope) {
      return this.validateScope(requiredScope, user);
    }

    return true;
  }

  private validateScope(scope: RbacScope, user: RbacUserContext): boolean {
    const tenantId = this.tenantContext.getTenantId();

    if (scope === 'tenant') {
      return Boolean(tenantId && tenantId === user.tenantId);
    }

    if (scope === 'tournament') {
      return Boolean(
        user.tournamentId &&
          user.tournamentId.length > 0 &&
          (!tenantId || tenantId === user.tenantId),
      );
    }

    if (scope === 'match') {
      return Boolean(
        user.matchId &&
          user.matchId.length > 0 &&
          (!tenantId || tenantId === user.tenantId),
      );
    }

    if (scope === 'team') {
      return Boolean(
        user.teamId &&
          user.teamId.length > 0 &&
          (!tenantId || tenantId === user.tenantId),
      );
    }

    return false;
  }
}
