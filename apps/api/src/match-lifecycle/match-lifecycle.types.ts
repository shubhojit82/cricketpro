import { MatchStatus } from '@prisma/client';

export type MatchLifecycleStatus = MatchStatus;

export interface MatchLifecycleStartContext {
  matchId: string;
  tenantId: string;
  tournament?: {
    id?: string;
    playingTeamSize?: number | null;
  };
  requireToss?: boolean;
  requireOfficials?: boolean;
}
