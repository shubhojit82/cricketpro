import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Match, MatchStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { UpdateMatchStatusDto } from './dto/update-match-status.dto';

@Injectable()
export class MatchService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private getTenantId(): string {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new NotFoundException('Tenant context is not initialized');
    }

    return tenantId;
  }

  private async assertTournamentInTenant(
    tournamentId: string,
    tenantId: string,
  ): Promise<void> {
    const tournament = await this.prismaService.tournament.findFirst({
      where: {
        id: tournamentId,
        tenantId,
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }
  }

  private async assertVenueInTenant(
    venueId: string,
    tenantId: string,
  ): Promise<void> {
    const venue = await this.prismaService.venue.findFirst({
      where: {
        id: venueId,
        tenantId,
      },
    });

    if (!venue) {
      throw new NotFoundException('Venue not found');
    }
  }

  private async assertTeamInTenant(
    teamId: string,
    tenantId: string,
    label = 'Team',
  ): Promise<void> {
    const team = await this.prismaService.team.findFirst({
      where: {
        id: teamId,
        tenantId,
      },
    });

    if (!team) {
      throw new NotFoundException(`${label} not found`);
    }
  }

  private async assertMatchInTenant(
    matchId: string,
    tenantId: string,
  ): Promise<Match> {
    const match = await this.prismaService.match.findFirst({
      where: {
        id: matchId,
        tenantId,
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return match;
  }

  private isStatusTransitionAllowed(
    current: MatchStatus,
    next: MatchStatus,
  ): boolean {
    if (current === next) {
      return true;
    }

    const allowedTransitions: Partial<Record<MatchStatus, MatchStatus[]>> = {
      [MatchStatus.SCHEDULED]: [
        MatchStatus.LIVE,
        MatchStatus.ABANDONED,
        MatchStatus.CANCELLED,
      ],
      [MatchStatus.LIVE]: [
        MatchStatus.COMPLETED,
        MatchStatus.ABANDONED,
        MatchStatus.CANCELLED,
      ],
      [MatchStatus.COMPLETED]: [],
      [MatchStatus.ABANDONED]: [],
      [MatchStatus.CANCELLED]: [],
    };

    return (allowedTransitions[current] ?? []).includes(next);
  }

  private validateStatusTransition(
    currentStatus: MatchStatus,
    nextStatus: MatchStatus,
  ): void {
    if (!this.isStatusTransitionAllowed(currentStatus, nextStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${nextStatus}`,
      );
    }
  }

  async create(dto: CreateMatchDto): Promise<Match> {
    const tenantId = this.getTenantId();

    await this.assertTournamentInTenant(dto.tournamentId, tenantId);

    if (dto.venueId) {
      await this.assertVenueInTenant(dto.venueId, tenantId);
    }

    await this.assertTeamInTenant(dto.homeTeamId, tenantId, 'Home team');
    await this.assertTeamInTenant(dto.awayTeamId, tenantId, 'Away team');

    if (dto.homeTeamId === dto.awayTeamId) {
      throw new BadRequestException(
        'Home and away teams must be different',
      );
    }

    const status = dto.status ?? MatchStatus.SCHEDULED;

    const match = await this.prismaService.match.create({
      data: {
        tenantId,
        tournamentId: dto.tournamentId,
        venueId: dto.venueId ?? null,
        homeTeamId: dto.homeTeamId,
        awayTeamId: dto.awayTeamId,
        status,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      },
    });

    await this.auditLogService.record({
      tenantId,
      action: 'MATCH_CREATED',
      entityType: 'Match',
      entityId: match.id,
      payload: {
        tournamentId: match.tournamentId,
        venueId: match.venueId,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        status: match.status,
        scheduledAt: match.scheduledAt,
      },
    });

    return match;
  }

  async findAll(): Promise<Match[]> {
    const tenantId = this.getTenantId();

    return this.prismaService.match.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(id: string): Promise<Match> {
    const tenantId = this.getTenantId();

    const match = await this.prismaService.match.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return match;
  }

  async update(id: string, dto: UpdateMatchDto): Promise<Match> {
    const tenantId = this.getTenantId();
    const existingMatch = await this.assertMatchInTenant(id, tenantId);

    const data: Prisma.MatchUpdateInput = {};

    if (dto.tournamentId !== undefined) {
      await this.assertTournamentInTenant(dto.tournamentId, tenantId);
      data.tournament = { connect: { id: dto.tournamentId } };
    }

    if (dto.venueId !== undefined) {
      if (dto.venueId === null) {
        data.venue = { disconnect: true };
      } else {
        await this.assertVenueInTenant(dto.venueId, tenantId);
        data.venue = { connect: { id: dto.venueId } };
      }
    }

    if (dto.homeTeamId !== undefined) {
      await this.assertTeamInTenant(dto.homeTeamId, tenantId, 'Home team');
      const nextAwayTeamId = dto.awayTeamId ?? existingMatch.awayTeamId;
      if (dto.homeTeamId === nextAwayTeamId) {
        throw new BadRequestException(
          'Home and away teams must be different',
        );
      }
      data.homeTeam = { connect: { id: dto.homeTeamId } };
    }

    if (dto.awayTeamId !== undefined) {
      await this.assertTeamInTenant(dto.awayTeamId, tenantId, 'Away team');
      const nextHomeTeamId = dto.homeTeamId ?? existingMatch.homeTeamId;
      if (dto.awayTeamId === nextHomeTeamId) {
        throw new BadRequestException(
          'Home and away teams must be different',
        );
      }
      data.awayTeam = { connect: { id: dto.awayTeamId } };
    }

    if (dto.scheduledAt !== undefined) {
      data.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    }

    if (dto.status !== undefined) {
      this.validateStatusTransition(existingMatch.status, dto.status);
      data.status = dto.status;
    }

    if (Object.keys(data).length === 0) {
      return existingMatch;
    }

    const updatedMatch = await this.prismaService.match.update({
      where: {
        id,
      },
      data,
    });

    const updated = await this.findById(id);

    await this.auditLogService.record({
      tenantId,
      action: 'MATCH_UPDATED',
      entityType: 'Match',
      entityId: updated.id,
      payload: {
        ...(dto.tournamentId !== undefined
          ? { tournamentId: updated.tournamentId }
          : {}),
        ...(dto.venueId !== undefined ? { venueId: updated.venueId } : {}),
        ...(dto.homeTeamId !== undefined
          ? { homeTeamId: updated.homeTeamId }
          : {}),
        ...(dto.awayTeamId !== undefined
          ? { awayTeamId: updated.awayTeamId }
          : {}),
        ...(dto.scheduledAt !== undefined
          ? { scheduledAt: updated.scheduledAt }
          : {}),
        ...(dto.status !== undefined ? { status: updated.status } : {}),
      },
    });

    return updated;
  }

  async updateStatus(id: string, dto: UpdateMatchStatusDto): Promise<Match> {
    const tenantId = this.getTenantId();
    const existingMatch = await this.assertMatchInTenant(id, tenantId);

    this.validateStatusTransition(existingMatch.status, dto.status);

    const updatedMatch = await this.prismaService.match.update({
      where: {
        id,
      },
      data: {
        status: dto.status,
      },
    });

    const updated = await this.findById(id);

    await this.auditLogService.record({
      tenantId,
      action: 'MATCH_STATUS_CHANGED',
      entityType: 'Match',
      entityId: updated.id,
      payload: {
        previousStatus: existingMatch.status,
        newStatus: updated.status,
      },
    });

    return updated;
  }
}
