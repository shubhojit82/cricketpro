import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TournamentService } from './tournament.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';

describe('TournamentService', () => {
  let service: TournamentService;
  let prismaService: any;
  let tenantContext: any;
  let auditLogService: any;

  beforeEach(() => {
    prismaService = {
      tournament: {
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

    service = new TournamentService(
      prismaService,
      tenantContext,
      auditLogService,
    );
  });

  const createDto: CreateTournamentDto = {
    name: 'Tournament One',
    code: 'TOUR-1',
  };

  const updateDto: UpdateTournamentDto = {
    name: 'Updated Tournament',
    code: 'TOUR-2',
  };

  it('creates a tournament and emits audit log', async () => {
    prismaService.tournament.create.mockResolvedValue({
      id: 'tournament-1',
      tenantId: 'tenant-1',
      name: 'Tournament One',
      code: 'TOUR-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create(createDto);

    expect(result.id).toBe('tournament-1');
    expect(prismaService.tournament.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        name: 'Tournament One',
        code: 'TOUR-1',
      },
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'TOURNAMENT_CREATED',
      entityType: 'Tournament',
      entityId: 'tournament-1',
      payload: {
        name: 'Tournament One',
        code: 'TOUR-1',
      },
    });
  });

  it('uses tenantId from TenantContextService', async () => {
    tenantContext.getTenantId.mockReturnValue('tenant-2');
    prismaService.tournament.create.mockResolvedValue({
      id: 'tournament-2',
      tenantId: 'tenant-2',
      name: 'Tournament One',
      code: 'TOUR-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create(createDto);

    expect(result.tenantId).toBe('tenant-2');
    expect(prismaService.tournament.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-2' }),
    });
  });

  it('throws ConflictException for duplicate tournament code', async () => {
    const error = new Error('Unique constraint failed') as Prisma.PrismaClientKnownRequestError;
    error.code = 'P2002';
    prismaService.tournament.create.mockRejectedValue(error);

    await expect(service.create(createDto)).rejects.toThrow(ConflictException);
  });

  it('finds all tournaments for tenant', async () => {
    const tournaments = [{ id: 't1' }, { id: 't2' }];
    prismaService.tournament.findMany.mockResolvedValue(tournaments);

    const result = await service.findAll();

    expect(result).toBe(tournaments);
    expect(prismaService.tournament.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('finds tournament by id successfully', async () => {
    const tournament = { id: 't1', tenantId: 'tenant-1' };
    prismaService.tournament.findFirst.mockResolvedValue(tournament);

    const result = await service.findById('t1');

    expect(result).toBe(tournament);
  });

  it('throws NotFoundException for cross-tenant tournament access', async () => {
    prismaService.tournament.findFirst.mockResolvedValue(null);

    await expect(service.findById('t1')).rejects.toThrow(NotFoundException);
  });

  it('updates a tournament and emits audit log', async () => {
    prismaService.tournament.updateMany.mockResolvedValue({ count: 1 });
    prismaService.tournament.findFirst.mockResolvedValue({
      id: 't1',
      tenantId: 'tenant-1',
      name: 'Updated Tournament',
      code: 'TOUR-2',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.update('t1', updateDto);

    expect(result.id).toBe('t1');
    expect(prismaService.tournament.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', tenantId: 'tenant-1' },
      data: { name: 'Updated Tournament', code: 'TOUR-2' },
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'TOURNAMENT_UPDATED',
      entityType: 'Tournament',
      entityId: 't1',
      payload: { name: 'Updated Tournament', code: 'TOUR-2' },
    });
  });

  it('throws ConflictException when update duplicates code', async () => {
    const error = new Error('Unique constraint failed') as Prisma.PrismaClientKnownRequestError;
    error.code = 'P2002';
    prismaService.tournament.updateMany.mockRejectedValue(error);

    await expect(service.update('t1', updateDto)).rejects.toThrow(ConflictException);
  });
});
