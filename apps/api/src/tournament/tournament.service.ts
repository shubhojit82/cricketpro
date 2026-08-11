import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Tournament } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';

@Injectable()
export class TournamentService {
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

  async create(dto: CreateTournamentDto): Promise<Tournament> {
    const tenantId = this.getTenantId();

    try {
      const tournament = await this.prismaService.tournament.create({
        data: {
          tenantId,
          name: dto.name,
          code: dto.code,
        },
      });

      await this.auditLogService.record({
        tenantId,
        action: 'TOURNAMENT_CREATED',
        entityType: 'Tournament',
        entityId: tournament.id,
        payload: {
          name: tournament.name,
          code: tournament.code,
        },
      });

      return tournament;
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(): Promise<Tournament[]> {
    const tenantId = this.getTenantId();
    return this.prismaService.tournament.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Tournament> {
    const tenantId = this.getTenantId();
    const tournament = await this.prismaService.tournament.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    return tournament;
  }

  async update(
    id: string,
    dto: UpdateTournamentDto,
  ): Promise<Tournament> {
    const tenantId = this.getTenantId();

    try {
      const updated = await this.prismaService.tournament.updateMany({
        where: {
          id,
          tenantId,
        },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.code !== undefined ? { code: dto.code } : {}),
        },
      });

      if (updated.count === 0) {
        throw new NotFoundException('Tournament not found');
      }

      const tournament = await this.findById(id);

      await this.auditLogService.record({
        tenantId,
        action: 'TOURNAMENT_UPDATED',
        entityType: 'Tournament',
        entityId: tournament.id,
        payload: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.code !== undefined ? { code: dto.code } : {}),
        },
      });

      return tournament;
    } catch (error) {
      this.handlePrismaError(error);
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

  private handlePrismaError(error: unknown): never {
    if (this.isPrismaClientKnownRequestError(error)) {
      throw new ConflictException(
        'Tournament code already exists for this tenant',
      );
    }

    throw error;
  }
}
