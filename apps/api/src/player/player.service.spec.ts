import { NotFoundException } from '@nestjs/common';
import { PlayerService } from './player.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

describe('PlayerService', () => {
  let service: PlayerService;
  let prismaService: any;
  let tenantContext: any;
  let auditLogService: any;

  beforeEach(() => {
    prismaService = {
      player: {
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

    service = new PlayerService(prismaService, tenantContext, auditLogService);
  });

  const createDto: CreatePlayerDto = {
    firstName: 'First',
    lastName: 'Last',
  };

  const updateDto: UpdatePlayerDto = {
    firstName: 'Updated',
    lastName: 'Name',
  };

  it('creates a player and emits audit log', async () => {
    prismaService.player.create.mockResolvedValue({
      id: 'player-1',
      tenantId: 'tenant-1',
      firstName: 'First',
      lastName: 'Last',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create(createDto);

    expect(result.id).toBe('player-1');
    expect(prismaService.player.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        firstName: 'First',
        lastName: 'Last',
      },
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'PLAYER_CREATED',
      entityType: 'Player',
      entityId: 'player-1',
      payload: {
        firstName: 'First',
        lastName: 'Last',
      },
    });
  });

  it('uses tenantId from TenantContextService', async () => {
    tenantContext.getTenantId.mockReturnValue('tenant-2');
    prismaService.player.create.mockResolvedValue({
      id: 'player-2',
      tenantId: 'tenant-2',
      firstName: 'First',
      lastName: 'Last',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create(createDto);

    expect(result.tenantId).toBe('tenant-2');
    expect(prismaService.player.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-2' }),
    });
  });

  it('finds all players for tenant', async () => {
    const players = [{ id: 'p1' }, { id: 'p2' }];
    prismaService.player.findMany.mockResolvedValue(players);

    const result = await service.findAll();

    expect(result).toBe(players);
    expect(prismaService.player.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('finds player by id successfully', async () => {
    const player = { id: 'p1', tenantId: 'tenant-1' };
    prismaService.player.findFirst.mockResolvedValue(player);

    const result = await service.findById('p1');

    expect(result).toBe(player);
  });

  it('throws NotFoundException for cross-tenant player access', async () => {
    prismaService.player.findFirst.mockResolvedValue(null);

    await expect(service.findById('p1')).rejects.toThrow(NotFoundException);
  });

  it('updates a player and emits audit log', async () => {
    prismaService.player.updateMany.mockResolvedValue({ count: 1 });
    prismaService.player.findFirst.mockResolvedValue({
      id: 'p1',
      tenantId: 'tenant-1',
      firstName: 'Updated',
      lastName: 'Name',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.update('p1', updateDto);

    expect(result.id).toBe('p1');
    expect(prismaService.player.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', tenantId: 'tenant-1' },
      data: { firstName: 'Updated', lastName: 'Name' },
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'PLAYER_UPDATED',
      entityType: 'Player',
      entityId: 'p1',
      payload: { firstName: 'Updated', lastName: 'Name' },
    });
  });
});
