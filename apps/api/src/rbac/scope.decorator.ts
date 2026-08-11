import { SetMetadata } from '@nestjs/common';
import { RbacScope } from './rbac.types';

export const SCOPE_KEY = 'rbac:scope';
export const Scope = (scope: RbacScope) => SetMetadata(SCOPE_KEY, scope);
