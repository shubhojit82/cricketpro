import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Venue } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';

@Injectable()
export class VenueService {
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

  async create(dto: CreateVenueDto): Promise<Venue> {
    const tenantId = this.getTenantId();

    const venue = await this.prismaService.venue.create({
      data: {
        tenantId,
        name: dto.name,
        city: dto.city ?? null,
        country: dto.country ?? null,
      },
    });

    await this.auditLogService.record({
      tenantId,
      action: 'VENUE_CREATED',
      entityType: 'Venue',
      entityId: venue.id,
      payload: {
        name: venue.name,
        city: venue.city,
        country: venue.country,
      },
    });

    return venue;
  }

  async findAll(): Promise<Venue[]> {
    const tenantId = this.getTenantId();
    return this.prismaService.venue.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Venue> {
    const tenantId = this.getTenantId();

    const venue = await this.prismaService.venue.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    return venue;
  }

  async update(id: string, dto: UpdateVenueDto): Promise<Venue> {
    const tenantId = this.getTenantId();

    const data: Prisma.VenueUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.city !== undefined) {
      data.city = dto.city;
    }

    if (dto.country !== undefined) {
      data.country = dto.country;
    }

    if (Object.keys(data).length === 0) {
      return this.findById(id);
    }

    const updated = await this.prismaService.venue.updateMany({
      where: {
        id,
        tenantId,
      },
      data,
    });

    if (updated.count === 0) {
      throw new NotFoundException('Venue not found');
    }

    const venue = await this.findById(id);

    await this.auditLogService.record({
      tenantId,
      action: 'VENUE_UPDATED',
      entityType: 'Venue',
      entityId: venue.id,
      payload: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
      },
    });

    return venue;
  }
}
