import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { TenantValidationResult } from './tenant.types';

@Injectable()
export class TenantService {
  constructor(private readonly prismaService: PrismaService) {}

  async validateTenant(
    tenantId: string,
  ): Promise<TenantValidationResult> {
    const tenant = await this.prismaService.tenant.findUnique({
      where: {
        id: tenantId,
      },
    });

    if (!tenant) {
      return {
        isValid: false,
        error: `Tenant with ID ${tenantId} not found`,
      };
    }

    return {
      isValid: true,
      tenant,
    };
  }
}
