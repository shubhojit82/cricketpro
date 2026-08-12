import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Match,
  MatchOfficial,
  MatchOfficialRole,
  MatchStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateMatchOfficialDto } from './dto/create-match-official.dto';
import { UpdateMatchOfficialDto } from './dto/update-match-official.dto';

@Injectable()
export class MatchOfficialService {
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

  private async assertOfficialInTenant(
    matchId: string,
    officialId: string,
    tenantId: string,
  ): Promise<MatchOfficial> {
    const official = await this.prismaService.matchOfficial.findFirst({
      where: {
        id: officialId,
        matchId,
        tenantId,
      },
    });

    if (!official) {
      throw new NotFoundException('Match official not found');
    }

    return official;
  }

  private async assertUserInTenant(
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const user = await this.prismaService.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private validateMatchEditable(match: Match): void {
    if (
      match.status === MatchStatus.LIVE ||
      match.status === MatchStatus.COMPLETED
    ) {
      throw new ConflictException(
        'Match officials cannot be changed once the match is live or completed',
      );
    }
  }

  private async assertUniqueOfficial(
    matchId: string,
    role: MatchOfficialRole,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prismaService.matchOfficial.findFirst({
      where: {
        matchId,
        role,
        name,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException(
        `A ${role} named "${name}" is already assigned to this match`,
      );
    }
  }

  async findAll(matchId: string): Promise<MatchOfficial[]> {
    const tenantId = this.getTenantId();
    await this.assertMatchInTenant(matchId, tenantId);

    return this.prismaService.matchOfficial.findMany({
      where: {
        matchId,
        tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(matchId: string, id: string): Promise<MatchOfficial> {
    const tenantId = this.getTenantId();
    await this.assertMatchInTenant(matchId, tenantId);

    return this.assertOfficialInTenant(matchId, id, tenantId);
  }

  async create(
    matchId: string,
    dto: CreateMatchOfficialDto,
  ): Promise<MatchOfficial> {
    const tenantId = this.getTenantId();
    const match = await this.assertMatchInTenant(matchId, tenantId);
    this.validateMatchEditable(match);

    if (dto.userId) {
      await this.assertUserInTenant(dto.userId, tenantId);
    }

    await this.assertUniqueOfficial(matchId, dto.role, dto.name);

    const official = await this.prismaService.matchOfficial.create({
      data: {
        tenantId,
        matchId,
        userId: dto.userId ?? null,
        name: dto.name,
        role: dto.role,
      },
    });

    await this.auditLogService.record({
      tenantId,
      action: 'MATCH_OFFICIAL_ADDED',
      entityType: 'MatchOfficial',
      entityId: official.id,
      payload: {
        matchId,
        userId: dto.userId ?? null,
        name: dto.name,
        role: dto.role,
      },
    });

    return official;
  }

  async update(
    matchId: string,
    id: string,
    dto: UpdateMatchOfficialDto,
  ): Promise<MatchOfficial> {
    const tenantId = this.getTenantId();
    const match = await this.assertMatchInTenant(matchId, tenantId);
    this.validateMatchEditable(match);
    const existing = await this.assertOfficialInTenant(matchId, id, tenantId);

    const data: Prisma.MatchOfficialUpdateInput = {};

    if (dto.role !== undefined) {
      data.role = dto.role;
    }

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.userId !== undefined) {
      if (dto.userId === null) {
        data.user = { disconnect: true };
      } else {
        await this.assertUserInTenant(dto.userId, tenantId);
        data.user = { connect: { id: dto.userId } };
      }
    }

    if (Object.keys(data).length === 0) {
      return existing;
    }

    const nextRole = dto.role ?? existing.role;
    const nextName = dto.name ?? existing.name;
    await this.assertUniqueOfficial(matchId, nextRole, nextName, id);

    const updated = await this.prismaService.matchOfficial.update({
      where: {
        id,
      },
      data,
    });

    await this.auditLogService.record({
      tenantId,
      action: 'MATCH_OFFICIAL_UPDATED',
      entityType: 'MatchOfficial',
      entityId: updated.id,
      payload: {
        matchId,
        role: updated.role,
        name: updated.name,
        userId: updated.userId,
      },
    });

    return updated;
  }

  async remove(matchId: string, id: string): Promise<MatchOfficial> {
    const tenantId = this.getTenantId();
    const match = await this.assertMatchInTenant(matchId, tenantId);
    this.validateMatchEditable(match);
    const official = await this.assertOfficialInTenant(matchId, id, tenantId);

    await this.prismaService.matchOfficial.delete({
      where: { id },
    });

    await this.auditLogService.record({
      tenantId,
      action: 'MATCH_OFFICIAL_REMOVED',
      entityType: 'MatchOfficial',
      entityId: official.id,
      payload: {
        matchId,
        role: official.role,
        name: official.name,
        userId: official.userId,
      },
    });

    return official;
  }
}
