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
import { MatchLifecycleService } from '../match-lifecycle/match-lifecycle.service';
import { SetPlayingXiDto } from './dto/set-playing-xi.dto';
import { UpdatePlayingXiPlayerDto } from './dto/update-playing-xi-player.dto';

const DEFAULT_PLAYING_XI_SIZE = 11;

@Injectable()
export class PlayingXiService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly auditLogService: AuditLogService,
    private readonly matchLifecycleService: MatchLifecycleService,
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

    return configuredSize ?? DEFAULT_PLAYING_XI_SIZE;
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

  private async assertPlayerInTenant(playerId: string, tenantId: string): Promise<void> {
    const player = await this.prismaService.player.findFirst({
      where: {
        id: playerId,
        tenantId,
      },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }
  }

  private assertTeamParticipatesInMatch(match: Match, teamId: string): void {
    if (teamId !== match.homeTeamId && teamId !== match.awayTeamId) {
      throw new BadRequestException('Team is not participating in this match');
    }
  }

  private validateMatchEditable(match: Match): void {
    this.matchLifecycleService.assertCanEditLineup(match.status);
  }

  private validatePlayerSelection(players: SetPlayingXiDto['players'], expectedSize: number): void {
    if (!Array.isArray(players) || players.length === 0) {
      throw new BadRequestException('Players array is required');
    }

    const playerIds = players.map((player) => player.playerId);
    const uniquePlayerIds = new Set(playerIds);

    if (uniquePlayerIds.size !== playerIds.length) {
      throw new BadRequestException('Duplicate player selection is not allowed');
    }

    if (playerIds.length !== expectedSize) {
      throw new BadRequestException(`Playing XI must contain exactly ${expectedSize} players`);
    }

    const captains = players.filter((player) => player.isCaptain);
    if (captains.length !== 1) {
      throw new BadRequestException('Exactly one captain must be selected');
    }

    const wicketKeepers = players.filter((player) => player.isWicketKeeper);
    if (wicketKeepers.length > 1) {
      throw new BadRequestException('At most one wicketkeeper may be selected');
    }
  }

  async setPlayingXI(matchId: string, teamId: string, dto: SetPlayingXiDto) {
    const tenantId = this.getTenantId();
    const match = await this.assertMatchInTenant(matchId, tenantId);
    await this.assertTeamInTenant(teamId, tenantId);
    this.assertTeamParticipatesInMatch(match, teamId);
    this.validateMatchEditable(match);

    const expectedSize = this.getEffectivePlayingTeamSize(match);
    this.validatePlayerSelection(dto.players, expectedSize);

    const playerIds = dto.players.map((player) => player.playerId);
    const players = await this.prismaService.player.findMany({
      where: {
        id: { in: playerIds },
        tenantId,
      },
      select: { id: true },
    });

    if (players.length !== playerIds.length) {
      throw new NotFoundException('One or more players not found');
    }

    const rosterEntries = await this.prismaService.teamPlayer.findMany({
      where: {
        teamId,
        playerId: { in: playerIds },
      },
      select: { playerId: true },
    });

    if (rosterEntries.length !== playerIds.length) {
      throw new NotFoundException('One or more players are not assigned to this team');
    }

    const existingSelection = await this.prismaService.matchPlayer.findMany({
      where: {
        matchId,
        playerId: { in: playerIds },
      },
    });

    if (existingSelection.some((entry) => entry.teamId !== teamId)) {
      throw new BadRequestException(
        'A player cannot be selected for both teams in the same match',
      );
    }

    const createData = dto.players.map((player) => ({
      matchId,
      teamId,
      playerId: player.playerId,
      isCaptain: player.isCaptain ?? false,
      isWicketKeeper: player.isWicketKeeper ?? false,
    }));

    await this.prismaService.$transaction([
      this.prismaService.matchPlayer.deleteMany({
        where: {
          matchId,
          teamId,
        },
      }),
      this.prismaService.matchPlayer.createMany({
        data: createData,
      }),
    ]);

    await this.auditLogService.record({
      tenantId,
      action: 'PLAYING_XI_SET',
      entityType: 'PlayingXI',
      entityId: `${matchId}:${teamId}`,
      payload: {
        matchId,
        teamId,
        selectedPlayerIds: playerIds,
        captainId: dto.players.find((player) => player.isCaptain)?.playerId ?? null,
        wicketKeeperId: dto.players.find((player) => player.isWicketKeeper)?.playerId ?? null,
      },
    });

    return this.getPlayingXI(matchId, teamId);
  }

  async getPlayingXI(matchId: string, teamId: string) {
    const tenantId = this.getTenantId();
    const match = await this.assertMatchInTenant(matchId, tenantId);
    await this.assertTeamInTenant(teamId, tenantId);
    this.assertTeamParticipatesInMatch(match, teamId);

    return this.prismaService.matchPlayer.findMany({
      where: {
        matchId,
        teamId,
      },
      include: {
        player: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async updatePlayer(
    matchId: string,
    teamId: string,
    playerId: string,
    dto: UpdatePlayingXiPlayerDto,
  ) {
    const tenantId = this.getTenantId();
    const match = await this.assertMatchInTenant(matchId, tenantId);
    await this.assertTeamInTenant(teamId, tenantId);
    this.assertTeamParticipatesInMatch(match, teamId);
    this.validateMatchEditable(match);

    const existingSelection = await this.prismaService.matchPlayer.findFirst({
      where: {
        matchId,
        teamId,
        playerId,
      },
    });

    if (!existingSelection) {
      throw new NotFoundException('Player is not selected for this match and team');
    }

    if (dto.isCaptain === false && existingSelection.isCaptain) {
      const otherCaptain = await this.prismaService.matchPlayer.findFirst({
        where: {
          matchId,
          teamId,
          isCaptain: true,
          playerId: { not: playerId },
        },
      });

      if (!otherCaptain) {
        throw new BadRequestException('Playing XI must have exactly one captain');
      }
    }

    if (dto.isCaptain === true) {
      await this.prismaService.matchPlayer.updateMany({
        where: {
          matchId,
          teamId,
          isCaptain: true,
        },
        data: {
          isCaptain: false,
        },
      });
    }

    if (dto.isWicketKeeper === true) {
      await this.prismaService.matchPlayer.updateMany({
        where: {
          matchId,
          teamId,
          isWicketKeeper: true,
        },
        data: {
          isWicketKeeper: false,
        },
      });
    }

    const updateData: Prisma.MatchPlayerUpdateInput = {};
    if (dto.isCaptain !== undefined) {
      updateData.isCaptain = dto.isCaptain;
    }
    if (dto.isWicketKeeper !== undefined) {
      updateData.isWicketKeeper = dto.isWicketKeeper;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No update fields provided');
    }

    const updated = await this.prismaService.matchPlayer.update({
      where: {
        id: existingSelection.id,
      },
      data: updateData,
    });

    await this.auditLogService.record({
      tenantId,
      action: 'PLAYING_XI_PLAYER_UPDATED',
      entityType: 'PlayingXI',
      entityId: `${matchId}:${teamId}`,
      payload: {
        matchId,
        teamId,
        playerId,
        isCaptain: updated.isCaptain,
        isWicketKeeper: updated.isWicketKeeper,
      },
    });

    return updated;
  }

  async removePlayer(matchId: string, teamId: string, playerId: string) {
    const tenantId = this.getTenantId();
    const match = await this.assertMatchInTenant(matchId, tenantId);
    await this.assertTeamInTenant(teamId, tenantId);
    this.assertTeamParticipatesInMatch(match, teamId);
    this.validateMatchEditable(match);

    const existingSelection = await this.prismaService.matchPlayer.findFirst({
      where: {
        matchId,
        teamId,
        playerId,
      },
    });

    if (!existingSelection) {
      throw new NotFoundException('Player is not selected for this match and team');
    }

    const deleted = await this.prismaService.matchPlayer.delete({
      where: {
        id: existingSelection.id,
      },
    });

    await this.auditLogService.record({
      tenantId,
      action: 'PLAYING_XI_PLAYER_REMOVED',
      entityType: 'PlayingXI',
      entityId: `${matchId}:${teamId}`,
      payload: {
        matchId,
        teamId,
        playerId,
      },
    });

    return deleted;
  }
}
