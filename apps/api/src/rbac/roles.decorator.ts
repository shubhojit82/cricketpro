import { SetMetadata } from '@nestjs/common';
import { RoleName } from './rbac.types';

export const ROLES_KEY = 'rbac:roles';
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
