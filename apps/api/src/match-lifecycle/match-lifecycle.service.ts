import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { MatchLifecycleStartContext } from './match-lifecycle.types';

@Injectable()
export class MatchLifecycleService {
  private readonly transitionMap: Partial<Record<MatchStatus, MatchStatus[]>> = {
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

  constructor(private readonly prismaService: PrismaService) {}

  canTransition(from: MatchStatus, to: MatchStatus): boolean {
    if (from === to) {
      return true;
    }

    return (this.transitionMap[from] ?? []).includes(to);
  }

  assertTransitionAllowed(from: MatchStatus, to: MatchStatus): void {
    if (!this.canTransition(from, to)) {
      throw new BadRequestException(
        `Invalid status transition from ${from} to ${to}`,
      );
    }
  }

  assertCanEditLineup(status: MatchStatus): void {
    if (!this.canEditLineup(status)) {
      throw new ConflictException(
        'Lineup cannot be modified once the match is live or completed',
      );
    }
  }

  assertCanEditToss(status: MatchStatus): void {
    if (!this.canEditToss(status)) {
      throw new ConflictException(
        'Toss cannot be modified once the match is live or completed',
      );
    }
  }

  assertCanEditOfficials(status: MatchStatus): void {
    if (!this.canEditOfficials(status)) {
      throw new ConflictException(
        'Match officials cannot be changed once the match is live or completed',
      );
    }
  }

  assertCanScore(status: MatchStatus): void {
    if (!this.canScore(status)) {
      throw new ConflictException(
        'Scoring is only allowed while the match is live',
      );
    }
  }

  isPreMatch(status: MatchStatus): boolean {
    return status === MatchStatus.SCHEDULED;
  }

  isLive(status: MatchStatus): boolean {
    return status === MatchStatus.LIVE;
  }

  isTerminal(status: MatchStatus): boolean {
    return (
      status === MatchStatus.COMPLETED ||
      status === MatchStatus.ABANDONED ||
      status === MatchStatus.CANCELLED
    );
  }

  canEditLineup(status: MatchStatus): boolean {
    return this.isPreMatch(status);
  }

  canEditToss(status: MatchStatus): boolean {
    return this.isPreMatch(status);
  }

  canEditOfficials(status: MatchStatus): boolean {
    return this.isPreMatch(status);
  }

  canScore(status: MatchStatus): boolean {
    return this.isLive(status);
  }

  getEffectivePlayingTeamSize(match: {
    playingTeamSize?: number | null;
    tournament?: { playingTeamSize?: number | null } | null;
  }): number {
    const configuredSize = match.playingTeamSize ?? match.tournament?.playingTeamSize;

    if (configuredSize !== undefined && configuredSize !== null && configuredSize <= 0) {
      throw new BadRequestException(
        'Configured playing team size must be a positive integer',
      );
    }

    return configuredSize ?? 11;
  }

  async assertCanStartMatch(context: MatchLifecycleStartContext): Promise<void> {
    const { matchId, tenantId } = context;

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

    if (this.isTerminal(match.status)) {
      throw new ConflictException('Match is already in a terminal state');
    }

    const tournamentSize = context.tournament?.playingTeamSize ?? match.tournament?.playingTeamSize ?? 11;
    const requiredSize = match.playingTeamSize ?? tournamentSize;

    if (requiredSize <= 0) {
      throw new BadRequestException('Configured playing team size must be a positive integer');
    }

    const [homeCount, awayCount] = await Promise.all([
      this.prismaService.matchPlayer.count({
        where: {
          matchId,
          teamId: match.homeTeamId,
        },
      }),
      this.prismaService.matchPlayer.count({
        where: {
          matchId,
          teamId: match.awayTeamId,
        },
      }),
    ]);

    if (homeCount !== requiredSize || awayCount !== requiredSize) {
      throw new ConflictException(
        `Both teams must have exactly ${requiredSize} selected players before the match can start`,
      );
    }

    if (context.requireToss ?? true) {
      const toss = await this.prismaService.matchToss.findUnique({
        where: { matchId },
      });

      if (!toss) {
        throw new ConflictException('Toss must be recorded before the match can start');
      }

      if (toss.winnerTeamId !== match.homeTeamId && toss.winnerTeamId !== match.awayTeamId) {
        throw new ConflictException('Toss winner must be one of the participating teams');
      }
    }
  }
}
