import type { RoleName as PrismaRoleName } from '@prisma/client';

export type RoleName = PrismaRoleName;

export type RbacScope = 'tenant' | 'tournament' | 'match' | 'team';

export interface RbacUserContext {
  id: string;
  roles: RoleName[];
  permissions: string[];
  tenantId?: string;
  tournamentId?: string;
  matchId?: string;
  teamId?: string;
}
