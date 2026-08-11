import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Team } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamService {
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

  async create(dto: CreateTeamDto): Promise<Team> {
    const tenantId = this.getTenantId();

    const team = await this.prismaService.team.create({
      data: {
        tenantId,
        name: dto.name,
        shortName: dto.shortName ?? null,
      },
    });

    await this.auditLogService.record({
      tenantId,
      action: 'TEAM_CREATED',
      entityType: 'Team',
      entityId: team.id,
      payload: {
        name: team.name,
        shortName: team.shortName,
      },
    });

    return team;
  }

  async findAll(): Promise<Team[]> {
    const tenantId = this.getTenantId();
    return this.prismaService.team.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Team> {
    const tenantId = this.getTenantId();

    const team = await this.prismaService.team.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  async update(id: string, dto: UpdateTeamDto): Promise<Team> {
    const tenantId = this.getTenantId();

    const data: Prisma.TeamUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.shortName !== undefined) {
      data.shortName = dto.shortName;
    }

    if (Object.keys(data).length === 0) {
      return this.findById(id);
    }

    const updated = await this.prismaService.team.updateMany({
      where: {
        id,
        tenantId,
      },
      data,
    });

    if (updated.count === 0) {
      throw new NotFoundException('Team not found');
    }

    const team = await this.findById(id);

    await this.auditLogService.record({
      tenantId,
      action: 'TEAM_UPDATED',
      entityType: 'Team',
      entityId: team.id,
      payload: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.shortName !== undefined ? { shortName: dto.shortName } : {}),
      },
    });

    return team;
  }
}
