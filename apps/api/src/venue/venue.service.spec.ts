import { NotFoundException } from '@nestjs/common';
import { VenueService } from './venue.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';

describe('VenueService', () => {
  let service: VenueService;
  let prismaService: any;
  let tenantContext: any;
  let auditLogService: any;

  beforeEach(() => {
    prismaService = {
      venue: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    tenantContext = {
      getTenantId: jest.fn().mockReturnValue('tenant-1'),
    };

    auditLogService = {
      record: jest.fn(),
    };

    service = new VenueService(prismaService, tenantContext, auditLogService);
  });

  const createDto: CreateVenueDto = {
    name: 'Wankhede',
    city: 'Mumbai',
    country: 'India',
  };

  const updateDto: UpdateVenueDto = {
    name: 'Updated Venue',
    city: 'Delhi',
  };

  it('creates a venue and emits audit log', async () => {
    prismaService.venue.create.mockResolvedValue({
      id: 'venue-1',
      tenantId: 'tenant-1',
      name: 'Wankhede',
      city: 'Mumbai',
      country: 'India',
      createdAt: new Date(),
    });

    const result = await service.create(createDto);

    expect(result.id).toBe('venue-1');
    expect(prismaService.venue.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        name: 'Wankhede',
        city: 'Mumbai',
        country: 'India',
      },
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'VENUE_CREATED',
      entityType: 'Venue',
      entityId: 'venue-1',
      payload: {
        name: 'Wankhede',
        city: 'Mumbai',
        country: 'India',
      },
    });
  });

  it('uses tenantId from TenantContextService', async () => {
    tenantContext.getTenantId.mockReturnValue('tenant-2');
    prismaService.venue.create.mockResolvedValue({
      id: 'venue-2',
      tenantId: 'tenant-2',
      name: 'Wankhede',
      city: 'Mumbai',
      country: 'India',
      createdAt: new Date(),
    });

    const result = await service.create(createDto);

    expect(result.tenantId).toBe('tenant-2');
    expect(prismaService.venue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-2' }),
    });
  });

  it('finds all venues for tenant', async () => {
    const venues = [{ id: 'v1' }, { id: 'v2' }];
    prismaService.venue.findMany.mockResolvedValue(venues);

    const result = await service.findAll();

    expect(result).toBe(venues);
    expect(prismaService.venue.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('finds venue by id successfully', async () => {
    const venue = { id: 'v1', tenantId: 'tenant-1' };
    prismaService.venue.findFirst.mockResolvedValue(venue);

    const result = await service.findById('v1');

    expect(result).toBe(venue);
  });

  it('throws NotFoundException for cross-tenant venue access', async () => {
    prismaService.venue.findFirst.mockResolvedValue(null);

    await expect(service.findById('v1')).rejects.toThrow(NotFoundException);
  });

  it('updates a venue and emits audit log', async () => {
    prismaService.venue.updateMany.mockResolvedValue({ count: 1 });
    prismaService.venue.findFirst.mockResolvedValue({
      id: 'v1',
      tenantId: 'tenant-1',
      name: 'Updated Venue',
      city: 'Delhi',
      country: 'India',
      createdAt: new Date(),
    });

    const result = await service.update('v1', updateDto);

    expect(result.id).toBe('v1');
    expect(prismaService.venue.updateMany).toHaveBeenCalledWith({
      where: { id: 'v1', tenantId: 'tenant-1' },
      data: { name: 'Updated Venue', city: 'Delhi' },
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'VENUE_UPDATED',
      entityType: 'Venue',
      entityId: 'v1',
      payload: { name: 'Updated Venue', city: 'Delhi' },
    });
  });
});
