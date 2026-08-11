import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { MatchService } from './match.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { UpdateMatchStatusDto } from './dto/update-match-status.dto';

describe('MatchService', () => {
  let service: MatchService;
  let prismaService: any;
  let tenantContext: any;
  let auditLogService: any;

  beforeEach(() => {
    prismaService = {
      match: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      tournament: {
        findFirst: jest.fn(),
      },
      venue: {
        findFirst: jest.fn(),
      },
      team: {
        findFirst: jest.fn(),
      },
    };

    tenantContext = {
      getTenantId: jest.fn().mockReturnValue('tenant-1'),
    };

    auditLogService = {
      record: jest.fn(),
    };

    service = new MatchService(prismaService, tenantContext, auditLogService);
  });

  const createDto: CreateMatchDto = {
    tournamentId: 'tournament-1',
    venueId: 'venue-1',
    homeTeamId: 'team-a',
    awayTeamId: 'team-b',
    scheduledAt: '2026-01-15T18:00:00.000Z',
    status: MatchStatus.SCHEDULED,
  };

  it('creates a match and emits audit log', async () => {
    prismaService.tournament.findFirst.mockResolvedValue({ id: 'tournament-1', tenantId: 'tenant-1' });
    prismaService.venue.findFirst.mockResolvedValue({ id: 'venue-1', tenantId: 'tenant-1' });
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });
    prismaService.match.create.mockResolvedValue({
      id: 'match-1',
      tenantId: 'tenant-1',
      tournamentId: 'tournament-1',
      venueId: 'venue-1',
      homeTeamId: 'team-a',
      awayTeamId: 'team-b',
      status: MatchStatus.SCHEDULED,
      scheduledAt: new Date('2026-01-15T18:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create(createDto);

    expect(result.id).toBe('match-1');
    expect(prismaService.match.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        tournamentId: 'tournament-1',
        venueId: 'venue-1',
        homeTeamId: 'team-a',
        awayTeamId: 'team-b',
        status: MatchStatus.SCHEDULED,
        scheduledAt: new Date('2026-01-15T18:00:00.000Z'),
      },
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'MATCH_CREATED',
      entityType: 'Match',
      entityId: 'match-1',
      payload: {
        tournamentId: 'tournament-1',
        venueId: 'venue-1',
        homeTeamId: 'team-a',
        awayTeamId: 'team-b',
        status: MatchStatus.SCHEDULED,
        scheduledAt: new Date('2026-01-15T18:00:00.000Z'),
      },
    });
  });

  it('uses tenantId from TenantContextService', async () => {
    tenantContext.getTenantId.mockReturnValue('tenant-2');
    prismaService.tournament.findFirst.mockResolvedValue({ id: 'tournament-1', tenantId: 'tenant-2' });
    prismaService.venue.findFirst.mockResolvedValue({ id: 'venue-1', tenantId: 'tenant-2' });
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-2' });
    prismaService.match.create.mockResolvedValue({
      id: 'match-2',
      tenantId: 'tenant-2',
      tournamentId: 'tournament-1',
      venueId: 'venue-1',
      homeTeamId: 'team-a',
      awayTeamId: 'team-b',
      status: MatchStatus.SCHEDULED,
      scheduledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create({
      tournamentId: 'tournament-1',
      venueId: 'venue-1',
      homeTeamId: 'team-a',
      awayTeamId: 'team-b',
    });

    expect(result.tenantId).toBe('tenant-2');
    expect(prismaService.match.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-2' }),
    });
  });

  it('rejects same team on both sides', async () => {
    prismaService.tournament.findFirst.mockResolvedValue({ id: 'tournament-1', tenantId: 'tenant-1' });
    prismaService.venue.findFirst.mockResolvedValue({ id: 'venue-1', tenantId: 'tenant-1' });
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });

    await expect(
      service.create({
        tournamentId: 'tournament-1',
        venueId: 'venue-1',
        homeTeamId: 'team-a',
        awayTeamId: 'team-a',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('finds all matches for tenant', async () => {
    const matches = [{ id: 'm1' }, { id: 'm2' }];
    prismaService.match.findMany.mockResolvedValue(matches);

    const result = await service.findAll();

    expect(result).toBe(matches);
    expect(prismaService.match.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('finds match by id successfully', async () => {
    const match = { id: 'm1', tenantId: 'tenant-1' };
    prismaService.match.findFirst.mockResolvedValue(match);

    const result = await service.findById('m1');

    expect(result).toBe(match);
  });

  it('throws NotFoundException for cross-tenant match access', async () => {
    prismaService.match.findFirst.mockResolvedValue(null);

    await expect(service.findById('m1')).rejects.toThrow(NotFoundException);
  });

  it('updates a match and emits audit log', async () => {
    prismaService.match.findFirst.mockResolvedValue({
      id: 'm1',
      tenantId: 'tenant-1',
      tournamentId: 'tournament-1',
      venueId: 'venue-1',
      homeTeamId: 'team-a',
      awayTeamId: 'team-b',
      status: MatchStatus.SCHEDULED,
      scheduledAt: new Date('2026-01-15T18:00:00.000Z'),
    });
    prismaService.tournament.findFirst.mockResolvedValue({ id: 'tournament-1', tenantId: 'tenant-1' });
    prismaService.venue.findFirst.mockResolvedValue({ id: 'venue-2', tenantId: 'tenant-1' });
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-c', tenantId: 'tenant-1' });
    prismaService.match.update.mockResolvedValue({
      id: 'm1',
      tenantId: 'tenant-1',
      tournamentId: 'tournament-1',
      venueId: 'venue-2',
      homeTeamId: 'team-a',
      awayTeamId: 'team-c',
      status: MatchStatus.SCHEDULED,
      scheduledAt: new Date('2026-01-20T18:00:00.000Z'),
    });
    prismaService.match.findFirst.mockResolvedValueOnce({
      id: 'm1',
      tenantId: 'tenant-1',
      tournamentId: 'tournament-1',
      venueId: 'venue-1',
      homeTeamId: 'team-a',
      awayTeamId: 'team-b',
      status: MatchStatus.SCHEDULED,
      scheduledAt: new Date('2026-01-15T18:00:00.000Z'),
    });
    prismaService.match.findFirst.mockResolvedValueOnce({
      id: 'm1',
      tenantId: 'tenant-1',
      tournamentId: 'tournament-1',
      venueId: 'venue-2',
      homeTeamId: 'team-a',
      awayTeamId: 'team-c',
      status: MatchStatus.SCHEDULED,
      scheduledAt: new Date('2026-01-20T18:00:00.000Z'),
    });

    const result = await service.update('m1', {
      venueId: 'venue-2',
      awayTeamId: 'team-c',
      scheduledAt: '2026-01-20T18:00:00.000Z',
    });

    expect(result.venueId).toBe('venue-2');
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'MATCH_UPDATED',
      entityType: 'Match',
      entityId: 'm1',
      payload: {
        venueId: 'venue-2',
        awayTeamId: 'team-c',
        scheduledAt: new Date('2026-01-20T18:00:00.000Z'),
      },
    });
  });

  it('validates status transitions', async () => {
    prismaService.match.findFirst.mockResolvedValue({
      id: 'm1',
      tenantId: 'tenant-1',
      status: MatchStatus.COMPLETED,
    });

    await expect(
      service.updateStatus('m1', { status: MatchStatus.LIVE }),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates status and emits audit log', async () => {
    prismaService.match.findFirst.mockResolvedValue({
      id: 'm1',
      tenantId: 'tenant-1',
      status: MatchStatus.SCHEDULED,
    });
    prismaService.match.update.mockResolvedValue({
      id: 'm1',
      tenantId: 'tenant-1',
      status: MatchStatus.LIVE,
    });
    prismaService.match.findFirst.mockResolvedValueOnce({
      id: 'm1',
      tenantId: 'tenant-1',
      status: MatchStatus.SCHEDULED,
    });
    prismaService.match.findFirst.mockResolvedValueOnce({
      id: 'm1',
      tenantId: 'tenant-1',
      status: MatchStatus.LIVE,
    });

    const result = await service.updateStatus('m1', { status: MatchStatus.LIVE });

    expect(result.status).toBe(MatchStatus.LIVE);
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'MATCH_STATUS_CHANGED',
      entityType: 'Match',
      entityId: 'm1',
      payload: {
        previousStatus: MatchStatus.SCHEDULED,
        newStatus: MatchStatus.LIVE,
      },
    });
  });
});
