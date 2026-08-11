import type { Prisma } from '@prisma/client';

export interface MatchEventAppendInput {
  tenantId: string;
  tournamentId: string;
  matchId: string;
  eventType: string;
  inningsNumber?: number;
  overNumber?: number;
  ballNumber?: number;
  sequenceNumber: number;
  payload: Prisma.InputJsonValue;
  createdBy?: string;
  deviceId?: string;
  clientEventId: string;
  supersedesEventId?: string;
  correlationId?: string;
}

export class MatchEventConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchEventConflictError';
  }
}

export class MatchEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchEventValidationError';
  }
}

export class MatchEventNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchEventNotFoundError';
  }
}
