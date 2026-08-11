import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RosterService } from './roster.service';

describe('RosterService', () => {
  let service: RosterService;
  let prismaService: any;
  let tenantContext: any;
  let auditLogService: any;

  beforeEach(() => {
    prismaService = {
      team: {
        findFirst: jest.fn(),
      },
      player: {
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      teamPlayer: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    tenantContext = {
      getTenantId: jest.fn().mockReturnValue('tenant-1'),
    };

    auditLogService = {
      record: jest.fn(),
    };

    service = new RosterService(prismaService, tenantContext, auditLogService);
  });

  it('adds a player to a team and emits audit log', async () => {
    prismaService.team.findFirst.mockResolvedValue({
      id: 'team-1',
      tenantId: 'tenant-1',
    });
    prismaService.player.findFirst.mockResolvedValue({
      id: 'player-1',
      tenantId: 'tenant-1',
    });
    prismaService.teamPlayer.findFirst.mockResolvedValue(null);
    prismaService.teamPlayer.create.mockResolvedValue({
      id: 'roster-1',
      teamId: 'team-1',
      playerId: 'player-1',
      createdAt: new Date(),
    });

    const result = await service.addPlayer('team-1', 'player-1');

    expect(result.id).toBe('roster-1');
    expect(prismaService.teamPlayer.create).toHaveBeenCalledWith({
      data: {
        teamId: 'team-1',
        playerId: 'player-1',
      },
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'PLAYER_ADDED_TO_TEAM',
      entityType: 'TeamPlayer',
      entityId: 'roster-1',
      payload: {
        teamId: 'team-1',
        playerId: 'player-1',
      },
    });
  });

  it('throws NotFoundException when team belongs to another tenant', async () => {
    prismaService.team.findFirst.mockResolvedValue(null);

    await expect(service.addPlayer('team-1', 'player-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when player belongs to another tenant', async () => {
    prismaService.team.findFirst.mockResolvedValue({
      id: 'team-1',
      tenantId: 'tenant-1',
    });
    prismaService.player.findFirst.mockResolvedValue(null);

    await expect(service.addPlayer('team-1', 'player-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ConflictException when member is already present', async () => {
    prismaService.team.findFirst.mockResolvedValue({
      id: 'team-1',
      tenantId: 'tenant-1',
    });
    prismaService.player.findFirst.mockResolvedValue({
      id: 'player-1',
      tenantId: 'tenant-1',
    });
    prismaService.teamPlayer.findFirst.mockResolvedValue({
      id: 'roster-1',
      teamId: 'team-1',
      playerId: 'player-1',
    });

    await expect(service.addPlayer('team-1', 'player-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('lists only the current tenant players on a team', async () => {
    prismaService.team.findFirst.mockResolvedValue({
      id: 'team-1',
      tenantId: 'tenant-1',
    });
    prismaService.teamPlayer.findMany.mockResolvedValue([
      {
        id: 'roster-1',
        player: {
          id: 'player-1',
          tenantId: 'tenant-1',
          firstName: 'Jane',
          lastName: 'Doe',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ]);

    const result = await service.listPlayers('team-1');

    expect(result).toEqual([
      {
        id: 'player-1',
        tenantId: 'tenant-1',
        firstName: 'Jane',
        lastName: 'Doe',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
    ]);
    expect(prismaService.teamPlayer.findMany).toHaveBeenCalledWith({
      where: {
        teamId: 'team-1',
        player: {
          tenantId: 'tenant-1',
        },
      },
      include: {
        player: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('throws NotFoundException when listing a cross-tenant team', async () => {
    prismaService.team.findFirst.mockResolvedValue(null);

    await expect(service.listPlayers('team-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('removes a team-player membership and emits audit log', async () => {
    prismaService.team.findFirst.mockResolvedValue({
      id: 'team-1',
      tenantId: 'tenant-1',
    });
    prismaService.player.findFirst.mockResolvedValue({
      id: 'player-1',
      tenantId: 'tenant-1',
    });
    prismaService.teamPlayer.findFirst.mockResolvedValue({
      id: 'roster-1',
      teamId: 'team-1',
      playerId: 'player-1',
    });
    prismaService.teamPlayer.delete.mockResolvedValue({
      id: 'roster-1',
      teamId: 'team-1',
      playerId: 'player-1',
      createdAt: new Date(),
    });

    const result = await service.removePlayer('team-1', 'player-1');

    expect(result.id).toBe('roster-1');
    expect(prismaService.teamPlayer.delete).toHaveBeenCalledWith({
      where: {
        id: 'roster-1',
      },
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'PLAYER_REMOVED_FROM_TEAM',
      entityType: 'TeamPlayer',
      entityId: 'roster-1',
      payload: {
        teamId: 'team-1',
        playerId: 'player-1',
      },
    });
  });

  it('throws NotFoundException when membership is missing', async () => {
    prismaService.team.findFirst.mockResolvedValue({
      id: 'team-1',
      tenantId: 'tenant-1',
    });
    prismaService.player.findFirst.mockResolvedValue({
      id: 'player-1',
      tenantId: 'tenant-1',
    });
    prismaService.teamPlayer.findFirst.mockResolvedValue(null);

    await expect(service.removePlayer('team-1', 'player-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('does not delete the player when removing membership', async () => {
    prismaService.team.findFirst.mockResolvedValue({
      id: 'team-1',
      tenantId: 'tenant-1',
    });
    prismaService.player.findFirst.mockResolvedValue({
      id: 'player-1',
      tenantId: 'tenant-1',
    });
    prismaService.teamPlayer.findFirst.mockResolvedValue({
      id: 'roster-1',
      teamId: 'team-1',
      playerId: 'player-1',
    });
    prismaService.teamPlayer.delete.mockResolvedValue({
      id: 'roster-1',
      teamId: 'team-1',
      playerId: 'player-1',
      createdAt: new Date(),
    });

    await service.removePlayer('team-1', 'player-1');

    expect(prismaService.player.delete).not.toHaveBeenCalled();
  });

  it('converts duplicate Prisma constraint errors into ConflictException', async () => {
    prismaService.team.findFirst.mockResolvedValue({
      id: 'team-1',
      tenantId: 'tenant-1',
    });
    prismaService.player.findFirst.mockResolvedValue({
      id: 'player-1',
      tenantId: 'tenant-1',
    });
    prismaService.teamPlayer.findFirst.mockResolvedValue(null);
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: 'test',
      },
    );
    prismaService.teamPlayer.create.mockRejectedValue(error);

    await expect(service.addPlayer('team-1', 'player-1')).rejects.toThrow(
      ConflictException,
    );
  });
});
