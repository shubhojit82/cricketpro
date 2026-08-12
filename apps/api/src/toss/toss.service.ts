import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Match, MatchStatus, Prisma, TossDecision } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SetTossDto } from './dto/set-toss.dto';

@Injectable()
export class TossService {
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

  private async assertMatchInTenant(matchId: string, tenantId: string): Promise<Match & { tournament: { playingTeamSize: number | null } }> {
    const match = await this.prismaService.match.findFirst({
      where: {
        id: matchId,
        tenantId,
      },
      include: {
        tournament: {
          select: {
            playingTeamSize: true,
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return match;
  }

  private getEffectivePlayingTeamSize(match: Match & { tournament: { playingTeamSize: number | null } }): number {
    const configuredSize = match.playingTeamSize ?? match.tournament?.playingTeamSize;

    if (configuredSize !== undefined && configuredSize !== null && configuredSize <= 0) {
      throw new BadRequestException('Configured playing team size must be a positive integer');
    }

    return configuredSize ?? 11;
  }

  private async assertLineupsComplete(match: Match & { tournament: { playingTeamSize: number | null } }): Promise<void> {
    const requiredSize = this.getEffectivePlayingTeamSize(match);

    const [homeCount, awayCount] = await Promise.all([
      this.prismaService.matchPlayer.count({
        where: {
          matchId: match.id,
          teamId: match.homeTeamId,
        },
      }),
      this.prismaService.matchPlayer.count({
        where: {
          matchId: match.id,
          teamId: match.awayTeamId,
        },
      }),
    ]);

    if (homeCount !== requiredSize || awayCount !== requiredSize) {
      throw new ConflictException(
        `Both teams must have exactly ${requiredSize} selected players before toss`,
      );
    }
  }

  private async assertTeamInTenant(teamId: string, tenantId: string): Promise<void> {
    const team = await this.prismaService.team.findFirst({
      where: {
        id: teamId,
        tenantId,
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }
  }

  private assertWinnerTeamParticipates(match: Match, winnerTeamId: string): void {
    if (winnerTeamId !== match.homeTeamId && winnerTeamId !== match.awayTeamId) {
      throw new ConflictException('Winner team must be one of the match participants');
    }
  }

  private validateTossCanBeChanged(match: Match, existingToss?: { winnerTeamId: string; decision: TossDecision }) {
    if (!existingToss) {
      if (match.status === MatchStatus.COMPLETED) {
        throw new ConflictException('Toss cannot be recorded for a completed match');
      }
      return;
    }

    if (
      match.status === MatchStatus.LIVE ||
      match.status === MatchStatus.COMPLETED
    ) {
      if (
        existingToss.winnerTeamId !== existingToss.winnerTeamId ||
        existingToss.decision !== existingToss.decision
      ) {
        // This condition is intentionally always false; exact match check is performed outside.
      }
    }
  }

  async setToss(matchId: string, dto: SetTossDto) {
    const tenantId = this.getTenantId();
    const match = await this.assertMatchInTenant(matchId, tenantId);
    await this.assertTeamInTenant(dto.winnerTeamId, tenantId);
    this.assertWinnerTeamParticipates(match, dto.winnerTeamId);

    const existingToss = await this.prismaService.matchToss.findUnique({
      where: {
        matchId,
      },
    });

    if (existingToss) {
      const isSame =
        existingToss.winnerTeamId === dto.winnerTeamId &&
        existingToss.decision === dto.decision;

      if (isSame) {
        return existingToss;
      }

      if (match.status === MatchStatus.LIVE || match.status === MatchStatus.COMPLETED) {
        throw new ConflictException(
          'Toss cannot be changed once the match is live or completed',
        );
      }

      await this.assertLineupsComplete(match);

      const updatedToss = await this.prismaService.matchToss.update({
        where: {
          matchId,
        },
        data: {
          winnerTeamId: dto.winnerTeamId,
          decision: dto.decision,
        },
      });

      await this.auditLogService.record({
        tenantId,
        action: 'MATCH_TOSS_UPDATED',
        entityType: 'MatchToss',
        entityId: matchId,
        payload: {
          matchId,
          winnerTeamId: dto.winnerTeamId,
          decision: dto.decision,
          previousWinnerTeamId: existingToss.winnerTeamId,
          previousDecision: existingToss.decision,
        },
      });

      return updatedToss;
    }

    if (match.status === MatchStatus.COMPLETED) {
      throw new ConflictException('Toss cannot be recorded for a completed match');
    }

    await this.assertLineupsComplete(match);

    const createdToss = await this.prismaService.matchToss.create({
      data: {
        matchId,
        winnerTeamId: dto.winnerTeamId,
        decision: dto.decision,
      },
    });

    await this.auditLogService.record({
      tenantId,
      action: 'MATCH_TOSS_SET',
      entityType: 'MatchToss',
      entityId: matchId,
      payload: {
        matchId,
        winnerTeamId: dto.winnerTeamId,
        decision: dto.decision,
      },
    });

    return createdToss;
  }

  async getToss(matchId: string) {
    const tenantId = this.getTenantId();
    await this.assertMatchInTenant(matchId, tenantId);

    const toss = await this.prismaService.matchToss.findUnique({
      where: {
        matchId,
      },
    });

    if (!toss) {
      throw new NotFoundException('Toss not found');
    }

    return toss;
  }
}
