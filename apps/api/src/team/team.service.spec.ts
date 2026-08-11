import { NotFoundException } from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

describe('TeamService', () => {
  let service: TeamService;
  let prismaService: any;
  let tenantContext: any;
  let auditLogService: any;

  beforeEach(() => {
    prismaService = {
      team: {
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

    service = new TeamService(prismaService, tenantContext, auditLogService);
  });

  const createDto: CreateTeamDto = {
    name: 'Team One',
    shortName: 'T1',
  };

  const updateDto: UpdateTeamDto = {
    name: 'Updated Team',
    shortName: 'UT',
  };

  it('creates a team and emits audit log', async () => {
    prismaService.team.create.mockResolvedValue({
      id: 'team-1',
      tenantId: 'tenant-1',
      name: 'Team One',
      shortName: 'T1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create(createDto);

    expect(result.id).toBe('team-1');
    expect(prismaService.team.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        name: 'Team One',
        shortName: 'T1',
      },
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'TEAM_CREATED',
      entityType: 'Team',
      entityId: 'team-1',
      payload: {
        name: 'Team One',
        shortName: 'T1',
      },
    });
  });

  it('uses tenantId from TenantContextService', async () => {
    tenantContext.getTenantId.mockReturnValue('tenant-2');
    prismaService.team.create.mockResolvedValue({
      id: 'team-2',
      tenantId: 'tenant-2',
      name: 'Team One',
      shortName: 'T1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create(createDto);

    expect(result.tenantId).toBe('tenant-2');
    expect(prismaService.team.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-2' }),
    });
  });

  it('finds all teams for tenant', async () => {
    const teams = [{ id: 't1' }, { id: 't2' }];
    prismaService.team.findMany.mockResolvedValue(teams);

    const result = await service.findAll();

    expect(result).toBe(teams);
    expect(prismaService.team.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('finds team by id successfully', async () => {
    const team = { id: 't1', tenantId: 'tenant-1' };
    prismaService.team.findFirst.mockResolvedValue(team);

    const result = await service.findById('t1');

    expect(result).toBe(team);
  });

  it('throws NotFoundException for cross-tenant team access', async () => {
    prismaService.team.findFirst.mockResolvedValue(null);

    await expect(service.findById('t1')).rejects.toThrow(NotFoundException);
  });

  it('updates a team and emits audit log', async () => {
    prismaService.team.updateMany.mockResolvedValue({ count: 1 });
    prismaService.team.findFirst.mockResolvedValue({
      id: 't1',
      tenantId: 'tenant-1',
      name: 'Updated Team',
      shortName: 'UT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.update('t1', updateDto);

    expect(result.id).toBe('t1');
    expect(prismaService.team.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', tenantId: 'tenant-1' },
      data: { name: 'Updated Team', shortName: 'UT' },
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'TEAM_UPDATED',
      entityType: 'Team',
      entityId: 't1',
      payload: { name: 'Updated Team', shortName: 'UT' },
    });
  });
});
