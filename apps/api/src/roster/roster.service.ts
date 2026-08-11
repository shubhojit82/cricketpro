import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TeamPlayer } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class RosterService {
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

  private async assertTeamInTenant(
    teamId: string,
    tenantId: string,
  ): Promise<void> {
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

  private async assertPlayerInTenant(
    playerId: string,
    tenantId: string,
  ): Promise<void> {
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

  private isDuplicateTeamPlayerError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  async addPlayer(teamId: string, playerId: string): Promise<TeamPlayer> {
    const tenantId = this.getTenantId();

    await this.assertTeamInTenant(teamId, tenantId);
    await this.assertPlayerInTenant(playerId, tenantId);

    const existingMembership = await this.prismaService.teamPlayer.findFirst({
      where: {
        teamId,
        playerId,
      },
    });

    if (existingMembership) {
      throw new ConflictException('Player is already assigned to this team');
    }

    try {
      const membership = await this.prismaService.teamPlayer.create({
        data: {
          teamId,
          playerId,
        },
      });

      await this.auditLogService.record({
        tenantId,
        action: 'PLAYER_ADDED_TO_TEAM',
        entityType: 'TeamPlayer',
        entityId: membership.id,
        payload: {
          teamId,
          playerId,
        },
      });

      return membership;
    } catch (error) {
      if (this.isDuplicateTeamPlayerError(error)) {
        throw new ConflictException('Player is already assigned to this team');
      }
      throw error;
    }
  }

  async listPlayers(teamId: string): Promise<any[]> {
    const tenantId = this.getTenantId();

    await this.assertTeamInTenant(teamId, tenantId);

    const memberships = await this.prismaService.teamPlayer.findMany({
      where: {
        teamId,
        player: {
          tenantId,
        },
      },
      include: {
        player: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return memberships.map((membership) => membership.player);
  }

  async removePlayer(teamId: string, playerId: string): Promise<TeamPlayer> {
    const tenantId = this.getTenantId();

    await this.assertTeamInTenant(teamId, tenantId);
    await this.assertPlayerInTenant(playerId, tenantId);

    const membership = await this.prismaService.teamPlayer.findFirst({
      where: {
        teamId,
        playerId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Player is not assigned to this team');
    }

    const deletedMembership = await this.prismaService.teamPlayer.delete({
      where: {
        id: membership.id,
      },
    });

    await this.auditLogService.record({
      tenantId,
      action: 'PLAYER_REMOVED_FROM_TEAM',
      entityType: 'TeamPlayer',
      entityId: deletedMembership.id,
      payload: {
        teamId,
        playerId,
      },
    });

    return deletedMembership;
  }
}
