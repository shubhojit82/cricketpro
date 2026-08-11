import { Injectable, Scope } from '@nestjs/common';
import { Prisma, MatchEvent } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import {
  MatchEventAppendInput,
  MatchEventConflictError,
  MatchEventNotFoundError,
  MatchEventValidationError,
} from './match-event.types';

@Injectable({ scope: Scope.REQUEST })
export class MatchEventService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async appendEvent(input: MatchEventAppendInput): Promise<MatchEvent> {
    const contextTenantId = this.tenantContext.getTenantId();
    if (contextTenantId && contextTenantId !== input.tenantId) {
      throw new MatchEventValidationError(
        'Tenant context does not match input tenantId',
      );
    }

    const tenant = await this.prismaService.tenant.findUnique({
      where: { id: input.tenantId },
    });

    if (!tenant) {
      throw new MatchEventNotFoundError(
        `Tenant not found: ${input.tenantId}`,
      );
    }

    const tournament = await this.prismaService.tournament.findUnique({
      where: { id: input.tournamentId },
    });

    if (!tournament) {
      throw new MatchEventNotFoundError(
        `Tournament not found: ${input.tournamentId}`,
      );
    }

    if (tournament.tenantId !== input.tenantId) {
      throw new MatchEventValidationError(
        'Tournament does not belong to tenant',
      );
    }

    const match = await this.prismaService.match.findUnique({
      where: { id: input.matchId },
    });

    if (!match) {
      throw new MatchEventNotFoundError(`Match not found: ${input.matchId}`);
    }

    if (match.tenantId !== input.tenantId) {
      throw new MatchEventValidationError(
        'Match does not belong to tenant',
      );
    }

    if (match.tournamentId !== input.tournamentId) {
      throw new MatchEventValidationError(
        'Match does not belong to tournament',
      );
    }

    if (input.supersedesEventId) {
      await this.validateSupersedesEvent(
        input.supersedesEventId,
        input.tenantId,
        input.matchId,
      );
    }

    const existingEvent = await this.getByClientEventId(
      input.tenantId,
      input.clientEventId,
    );

    if (existingEvent) {
      return existingEvent;
    }

    try {
      return await this.prismaService.$transaction(
        async (prisma) => {
          const existing = await prisma.matchEvent.findUnique({
            where: {
              tenantId_clientEventId: {
                tenantId: input.tenantId,
                clientEventId: input.clientEventId,
              },
            },
          });

          if (existing) {
            return existing;
          }

          return prisma.matchEvent.create({
            data: {
              tenantId: input.tenantId,
              tournamentId: input.tournamentId,
              matchId: input.matchId,
              eventType: input.eventType,
              inningsNumber: input.inningsNumber,
              overNumber: input.overNumber,
              ballNumber: input.ballNumber,
              sequenceNumber: input.sequenceNumber,
              payload: input.payload,
              createdBy: input.createdBy,
              deviceId: input.deviceId,
              clientEventId: input.clientEventId,
              supersedesEventId: input.supersedesEventId,
              correlationId: input.correlationId,
            },
          });
        },
      );
    } catch (error) {
      return this.handleCreateError(error, input);
    }
  }

  async getEventById(id: string): Promise<MatchEvent | null> {
    return this.prismaService.matchEvent.findUnique({
      where: { id },
    });
  }

  async getEventsForMatch(
    matchId: string,
    tenantId: string,
  ): Promise<MatchEvent[]> {
    return this.prismaService.matchEvent.findMany({
      where: {
        matchId,
        tenantId,
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });
  }

  async getByClientEventId(
    tenantId: string,
    clientEventId: string,
  ): Promise<MatchEvent | null> {
    return this.prismaService.matchEvent.findUnique({
      where: {
        tenantId_clientEventId: {
          tenantId,
          clientEventId,
        },
      },
    });
  }

  private async validateSupersedesEvent(
    supersedesEventId: string,
    tenantId: string,
    matchId: string,
  ): Promise<void> {
    const supersededEvent = await this.prismaService.matchEvent.findUnique({
      where: { id: supersedesEventId },
    });

    if (!supersededEvent) {
      throw new MatchEventNotFoundError(
        `Supersedes event not found: ${supersedesEventId}`,
      );
    }

    if (supersededEvent.tenantId !== tenantId) {
      throw new MatchEventValidationError(
        'Supersedes event tenant does not match',
      );
    }

    if (supersededEvent.matchId !== matchId) {
      throw new MatchEventValidationError(
        'Supersedes event match does not match',
      );
    }
  }

  private isPrismaClientKnownRequestError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as any).code === 'P2002')
    );
  }

  private async handleCreateError(
    error: unknown,
    input: MatchEventAppendInput,
  ): Promise<MatchEvent> {
    if (this.isPrismaClientKnownRequestError(error)) {
      const target = error.meta?.target;
      const targetFields = Array.isArray(target) ? target : [target];

      if (targetFields.includes('clientEventId')) {
        const existing = await this.getByClientEventId(
          input.tenantId,
          input.clientEventId,
        );
        if (existing) {
          return existing;
        }
      }

      if (targetFields.includes('sequenceNumber')) {
        throw new MatchEventConflictError(
          'Sequence number already exists for this match',
        );
      }
    }

    throw error;
  }
}
