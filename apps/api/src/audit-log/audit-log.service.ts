import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  AuditLogRecordInput,
  AuditLogValidationError,
} from './audit-log.types';

@Injectable()
export class AuditLogService {
  constructor(private readonly prismaService: PrismaService) {}

  async record(input: AuditLogRecordInput): Promise<AuditLog> {
    await this.validateTenantAndUser(input.tenantId, input.userId);

    return this.prismaService.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        payload: input.payload ?? Prisma.JsonNull,
        correlationId: input.correlationId ?? null,
      },
    });
  }

  async getById(id: string, tenantId: string): Promise<AuditLog | null> {
    return this.prismaService.auditLog.findFirst({
      where: {
        id,
        tenantId,
      },
    });
  }

  async getForEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    return this.prismaService.auditLog.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getForCorrelationId(
    tenantId: string,
    correlationId: string,
  ): Promise<AuditLog[]> {
    return this.prismaService.auditLog.findMany({
      where: {
        tenantId,
        correlationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private async validateTenantAndUser(
    tenantId: string,
    userId?: string,
  ): Promise<void> {
    const tenant = await this.prismaService.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new AuditLogValidationError(
        `Tenant not found: ${tenantId}`,
      );
    }

    if (!userId) {
      return;
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AuditLogValidationError(
        `User not found: ${userId}`,
      );
    }

    if (user.tenantId !== tenantId) {
      throw new AuditLogValidationError(
        'User does not belong to the provided tenant',
      );
    }
  }
}
