import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Player } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

@Injectable()
export class PlayerService {
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

  async create(dto: CreatePlayerDto): Promise<Player> {
    const tenantId = this.getTenantId();

    const player = await this.prismaService.player.create({
      data: {
        tenantId,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    await this.auditLogService.record({
      tenantId,
      action: 'PLAYER_CREATED',
      entityType: 'Player',
      entityId: player.id,
      payload: {
        firstName: player.firstName,
        lastName: player.lastName,
      },
    });

    return player;
  }

  async findAll(): Promise<Player[]> {
    const tenantId = this.getTenantId();
    return this.prismaService.player.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Player> {
    const tenantId = this.getTenantId();

    const player = await this.prismaService.player.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    return player;
  }

  async update(id: string, dto: UpdatePlayerDto): Promise<Player> {
    const tenantId = this.getTenantId();
    const data: Prisma.PlayerUpdateInput = {};

    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName;
    }

    if (dto.lastName !== undefined) {
      data.lastName = dto.lastName;
    }

    if (Object.keys(data).length === 0) {
      return this.findById(id);
    }

    const updated = await this.prismaService.player.updateMany({
      where: {
        id,
        tenantId,
      },
      data,
    });

    if (updated.count === 0) {
      throw new NotFoundException('Player not found');
    }

    const player = await this.findById(id);

    await this.auditLogService.record({
      tenantId,
      action: 'PLAYER_UPDATED',
      entityType: 'Player',
      entityId: player.id,
      payload: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      },
    });

    return player;
  }
}
