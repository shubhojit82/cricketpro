import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { PlayingXiService } from './playing-xi.service';
import { SetPlayingXiDto } from './dto/set-playing-xi.dto';
import { UpdatePlayingXiPlayerDto } from './dto/update-playing-xi-player.dto';

describe('PlayingXiService', () => {
  let service: PlayingXiService;
  let prismaService: any;
  let tenantContext: any;
  let auditLogService: any;

  const match: {
    id: string;
    tenantId: string;
    homeTeamId: string;
    awayTeamId: string;
    playingTeamSize: number | null;
    status: MatchStatus;
    tournament: {
      playingTeamSize: number | null;
    };
  } = {
    id: 'match-1',
    tenantId: 'tenant-1',
    homeTeamId: 'team-a',
    awayTeamId: 'team-b',
    playingTeamSize: null,
    status: MatchStatus.SCHEDULED,
    tournament: {
      playingTeamSize: 11,
    },
  };

  const players = Array.from({ length: 11 }, (_, index) => ({
    playerId: `player-${index + 1}`,
    isCaptain: index === 0,
    isWicketKeeper: index === 1,
  }));

  const buildPlayers = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      playerId: `player-${index + 1}`,
      isCaptain: index === 0,
      isWicketKeeper: index === 1,
    }));

  const buildMatch = (overrides: Partial<typeof match> = {}) => ({
    ...match,
    ...overrides,
    tournament: {
      playingTeamSize: overrides.tournament?.playingTeamSize ?? match.tournament.playingTeamSize,
    },
  });

  beforeEach(() => {
    prismaService = {
      match: {
        findFirst: jest.fn().mockResolvedValue(match),
      },
      team: {
        findFirst: jest.fn().mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' }),
      },
      player: {
        findMany: jest.fn().mockResolvedValue(players.map((player) => ({ id: player.playerId }))),
      },
      teamPlayer: {
        findMany: jest.fn().mockResolvedValue(players.map((player) => ({ playerId: player.playerId }))),
      },
      matchPlayer: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((operations) => Promise.all(operations)),
    };

    tenantContext = {
      getTenantId: jest.fn().mockReturnValue('tenant-1'),
    };

    auditLogService = {
      record: jest.fn().mockResolvedValue({}),
    };

    service = new PlayingXiService(
      prismaService,
      tenantContext,
      auditLogService,
      {
        assertCanEditLineup: jest.fn((status) => {
          if (status === MatchStatus.LIVE || status === MatchStatus.COMPLETED) {
            throw new ConflictException(
              'Playing XI cannot be modified once the match is live or completed',
            );
          }
        }),
      } as any,
    );
  });

  it('sets Playing XI successfully and emits audit log', async () => {
    prismaService.match.findFirst.mockResolvedValue(match);
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });
    prismaService.player.findMany.mockResolvedValue(players.map((player) => ({ id: player.playerId })));
    prismaService.teamPlayer.findMany.mockResolvedValue(players.map((player) => ({ playerId: player.playerId })));
    prismaService.matchPlayer.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(players.map((player) => ({
        matchId: match.id,
        teamId: 'team-a',
        playerId: player.playerId,
        isCaptain: player.isCaptain,
        isWicketKeeper: player.isWicketKeeper,
        player: { id: player.playerId, firstName: 'First', lastName: 'Last' },
      })));
    prismaService.matchPlayer.deleteMany.mockResolvedValue({ count: 0 });
    prismaService.matchPlayer.createMany.mockResolvedValue({ count: 11 });

    const dto: SetPlayingXiDto = { players };
    const result = await service.setPlayingXI('match-1', 'team-a', dto);

    expect(prismaService.matchPlayer.deleteMany).toHaveBeenCalledWith({
      where: { matchId: 'match-1', teamId: 'team-a' },
    });
    expect(prismaService.matchPlayer.createMany).toHaveBeenCalledWith({
      data: players.map((player) => ({
        matchId: 'match-1',
        teamId: 'team-a',
        playerId: player.playerId,
        isCaptain: player.isCaptain,
        isWicketKeeper: player.isWicketKeeper,
      })),
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'PLAYING_XI_SET',
      entityType: 'PlayingXI',
      entityId: 'match-1:team-a',
      payload: {
        matchId: 'match-1',
        teamId: 'team-a',
        selectedPlayerIds: players.map((player) => player.playerId),
        captainId: 'player-1',
        wicketKeeperId: 'player-2',
      },
    });
    expect(result).toHaveLength(11);
  });

  it('uses tenantId from TenantContextService', async () => {
    tenantContext.getTenantId.mockReturnValue('tenant-2');
    prismaService.match.findFirst.mockResolvedValue({ ...match, tenantId: 'tenant-2' });
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-2' });
    prismaService.player.findMany.mockResolvedValue(players.map((player) => ({ id: player.playerId })));
    prismaService.teamPlayer.findMany.mockResolvedValue(players.map((player) => ({ playerId: player.playerId })));
    prismaService.matchPlayer.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaService.matchPlayer.deleteMany.mockResolvedValue({ count: 0 });
    prismaService.matchPlayer.createMany.mockResolvedValue({ count: 11 });

    await expect(service.setPlayingXI('match-1', 'team-a', { players })).resolves.toBeDefined();
    expect(prismaService.match.findFirst).toHaveBeenCalledWith({
      where: { id: 'match-1', tenantId: 'tenant-2' },
      include: {
        tournament: {
          select: {
            playingTeamSize: true,
          },
        },
      },
    });
  });

  it('throws when match tenant validation fails', async () => {
    prismaService.match.findFirst.mockResolvedValue(null);
    await expect(service.setPlayingXI('match-1', 'team-a', { players })).rejects.toThrow(NotFoundException);
  });

  it('throws when team tenant validation fails', async () => {
    prismaService.match.findFirst.mockResolvedValue(match);
    prismaService.team.findFirst.mockResolvedValue(null);
    await expect(service.setPlayingXI('match-1', 'team-a', { players })).rejects.toThrow(NotFoundException);
  });

  it('throws when team does not participate in match', async () => {
    prismaService.match.findFirst.mockResolvedValue(match);
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-c', tenantId: 'tenant-1' });
    await expect(service.setPlayingXI('match-1', 'team-c', { players })).rejects.toThrow(BadRequestException);
  });

  it('throws when a player does not belong to tenant', async () => {
    prismaService.match.findFirst.mockResolvedValue(match);
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });
    prismaService.player.findMany.mockResolvedValue(players.slice(0, 10).map((player) => ({ id: player.playerId })));
    await expect(service.setPlayingXI('match-1', 'team-a', { players })).rejects.toThrow(NotFoundException);
  });

  it('throws when a player is not on team roster', async () => {
    prismaService.match.findFirst.mockResolvedValue(match);
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });
    prismaService.player.findMany.mockResolvedValue(players.map((player) => ({ id: player.playerId })));
    prismaService.teamPlayer.findMany.mockResolvedValue(players.slice(0, 10).map((player) => ({ playerId: player.playerId })));
    await expect(service.setPlayingXI('match-1', 'team-a', { players })).rejects.toThrow(NotFoundException);
  });

  it('throws when duplicate players are provided', async () => {
    const duplicatePlayers = [...players.slice(0, 10), players[0]];
    await expect(service.setPlayingXI('match-1', 'team-a', { players: duplicatePlayers })).rejects.toThrow(BadRequestException);
  });

  it('throws when lineup size is invalid', async () => {
    const shortLineup = players.slice(0, 10);
    await expect(service.setPlayingXI('match-1', 'team-a', { players: shortLineup })).rejects.toThrow(BadRequestException);
  });

  it('accepts exact tournament-configured lineup size of 8', async () => {
    const tournamentPlayers = buildPlayers(8);
    const matchWithConfig = buildMatch({ tournament: { playingTeamSize: 8 } });
    prismaService.match.findFirst.mockResolvedValue(matchWithConfig);
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });
    prismaService.player.findMany.mockResolvedValue(tournamentPlayers.map((player) => ({ id: player.playerId })));
    prismaService.teamPlayer.findMany.mockResolvedValue(tournamentPlayers.map((player) => ({ playerId: player.playerId })));
    prismaService.matchPlayer.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(tournamentPlayers.map((player) => ({
      matchId: matchWithConfig.id,
      teamId: 'team-a',
      playerId: player.playerId,
      isCaptain: player.isCaptain,
      isWicketKeeper: player.isWicketKeeper,
      player: { id: player.playerId, firstName: 'First', lastName: 'Last' },
    })));
    prismaService.matchPlayer.deleteMany.mockResolvedValue({ count: 0 });
    prismaService.matchPlayer.createMany.mockResolvedValue({ count: 8 });

    const result = await service.setPlayingXI('match-1', 'team-a', { players: tournamentPlayers });

    expect(prismaService.matchPlayer.createMany).toHaveBeenCalledWith({
      data: tournamentPlayers.map((player) => ({
        matchId: 'match-1',
        teamId: 'team-a',
        playerId: player.playerId,
        isCaptain: player.isCaptain,
        isWicketKeeper: player.isWicketKeeper,
      })),
    });
    expect(result).toHaveLength(8);
  });

  it('accepts exact tournament-configured lineup size of 12', async () => {
    const tournamentPlayers = buildPlayers(12);
    const matchWithConfig = buildMatch({ tournament: { playingTeamSize: 12 } });
    prismaService.match.findFirst.mockResolvedValue(matchWithConfig);
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });
    prismaService.player.findMany.mockResolvedValue(tournamentPlayers.map((player) => ({ id: player.playerId })));
    prismaService.teamPlayer.findMany.mockResolvedValue(tournamentPlayers.map((player) => ({ playerId: player.playerId })));
    prismaService.matchPlayer.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(tournamentPlayers.map((player) => ({
      matchId: matchWithConfig.id,
      teamId: 'team-a',
      playerId: player.playerId,
      isCaptain: player.isCaptain,
      isWicketKeeper: player.isWicketKeeper,
      player: { id: player.playerId, firstName: 'First', lastName: 'Last' },
    })));
    prismaService.matchPlayer.deleteMany.mockResolvedValue({ count: 0 });
    prismaService.matchPlayer.createMany.mockResolvedValue({ count: 12 });

    const result = await service.setPlayingXI('match-1', 'team-a', { players: tournamentPlayers });

    expect(prismaService.matchPlayer.createMany).toHaveBeenCalledWith({
      data: tournamentPlayers.map((player) => ({
        matchId: 'match-1',
        teamId: 'team-a',
        playerId: player.playerId,
        isCaptain: player.isCaptain,
        isWicketKeeper: player.isWicketKeeper,
      })),
    });
    expect(result).toHaveLength(12);
  });

  it('accepts exact match override lineup size of 6', async () => {
    const matchWithOverride = buildMatch({ playingTeamSize: 6, tournament: { playingTeamSize: 11 } });
    const matchPlayers = buildPlayers(6);
    prismaService.match.findFirst.mockResolvedValue(matchWithOverride);
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });
    prismaService.player.findMany.mockResolvedValue(matchPlayers.map((player) => ({ id: player.playerId })));
    prismaService.teamPlayer.findMany.mockResolvedValue(matchPlayers.map((player) => ({ playerId: player.playerId })));
    prismaService.matchPlayer.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(matchPlayers.map((player) => ({
      matchId: matchWithOverride.id,
      teamId: 'team-a',
      playerId: player.playerId,
      isCaptain: player.isCaptain,
      isWicketKeeper: player.isWicketKeeper,
      player: { id: player.playerId, firstName: 'First', lastName: 'Last' },
    })));
    prismaService.matchPlayer.deleteMany.mockResolvedValue({ count: 0 });
    prismaService.matchPlayer.createMany.mockResolvedValue({ count: 6 });

    const result = await service.setPlayingXI('match-1', 'team-a', { players: matchPlayers });

    expect(prismaService.matchPlayer.createMany).toHaveBeenCalledWith({
      data: matchPlayers.map((player) => ({
        matchId: 'match-1',
        teamId: 'team-a',
        playerId: player.playerId,
        isCaptain: player.isCaptain,
        isWicketKeeper: player.isWicketKeeper,
      })),
    });
    expect(result).toHaveLength(6);
  });

  it('rejects lineup smaller than configured size', async () => {
    const tournamentPlayers = buildPlayers(8);
    const shortLineup = tournamentPlayers.slice(0, 7);
    const matchWithConfig = buildMatch({ tournament: { playingTeamSize: 8 } });
    prismaService.match.findFirst.mockResolvedValue(matchWithConfig);
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });
    await expect(service.setPlayingXI('match-1', 'team-a', { players: shortLineup })).rejects.toThrow(BadRequestException);
  });

  it('rejects lineup larger than configured size', async () => {
    const tournamentPlayers = buildPlayers(8);
    const oversizedLineup = buildPlayers(9);
    const matchWithConfig = buildMatch({ tournament: { playingTeamSize: 8 } });
    prismaService.match.findFirst.mockResolvedValue(matchWithConfig);
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });
    await expect(service.setPlayingXI('match-1', 'team-a', { players: oversizedLineup })).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid configured playing team size', async () => {
    const invalidMatch = buildMatch({ playingTeamSize: 0, tournament: { playingTeamSize: 11 } });
    prismaService.match.findFirst.mockResolvedValue(invalidMatch);
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });
    await expect(service.setPlayingXI('match-1', 'team-a', { players: players })).rejects.toThrow(BadRequestException);
  });

  it('throws when no captain is selected', async () => {
    const noCaptain = players.map((player) => ({ ...player, isCaptain: false }));
    await expect(service.setPlayingXI('match-1', 'team-a', { players: noCaptain })).rejects.toThrow(BadRequestException);
  });

  it('throws when multiple captains are selected', async () => {
    const multiCaptain = players.map((player, index) => ({
      ...player,
      isCaptain: index < 2,
    }));
    await expect(service.setPlayingXI('match-1', 'team-a', { players: multiCaptain })).rejects.toThrow(BadRequestException);
  });

  it('throws when multiple wicketkeepers are selected', async () => {
    const multiKeeper = players.map((player, index) => ({
      ...player,
      isWicketKeeper: index < 2,
    }));
    await expect(service.setPlayingXI('match-1', 'team-a', { players: multiKeeper })).rejects.toThrow(BadRequestException);
  });

  it('returns lineup for a match team', async () => {
    prismaService.match.findFirst.mockResolvedValue(match);
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });
    prismaService.matchPlayer.findMany.mockResolvedValue(players.map((player) => ({
      matchId: match.id,
      teamId: 'team-a',
      playerId: player.playerId,
      isCaptain: player.isCaptain,
      isWicketKeeper: player.isWicketKeeper,
      player: { id: player.playerId, firstName: 'First', lastName: 'Last' },
    })));

    const result = await service.getPlayingXI('match-1', 'team-a');

    expect(result).toHaveLength(11);
    expect(result[0].player.id).toBe('player-1');
  });

  it('fails GET lineup when tenant context does not match', async () => {
    tenantContext.getTenantId.mockReturnValue('tenant-2');
    prismaService.match.findFirst.mockResolvedValue(null);
    await expect(service.getPlayingXI('match-1', 'team-a')).rejects.toThrow(NotFoundException);
  });

  it('updates captain and clears previous captain', async () => {
    prismaService.match.findFirst.mockResolvedValue(match);
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });
    prismaService.matchPlayer.findFirst.mockResolvedValue({
      id: 'selection-1',
      matchId: 'match-1',
      teamId: 'team-a',
      playerId: 'player-3',
      isCaptain: false,
      isWicketKeeper: false,
    });
    prismaService.matchPlayer.updateMany.mockResolvedValue({ count: 1 });
    prismaService.matchPlayer.update.mockResolvedValue({
      id: 'selection-1',
      matchId: 'match-1',
      teamId: 'team-a',
      playerId: 'player-3',
      isCaptain: true,
      isWicketKeeper: false,
    });

    const dto: UpdatePlayingXiPlayerDto = { isCaptain: true };
    const result = await service.updatePlayer('match-1', 'team-a', 'player-3', dto);

    expect(prismaService.matchPlayer.updateMany).toHaveBeenCalledWith({
      where: { matchId: 'match-1', teamId: 'team-a', isCaptain: true },
      data: { isCaptain: false },
    });
    expect(prismaService.matchPlayer.update).toHaveBeenCalledWith({
      where: { id: 'selection-1' },
      data: { isCaptain: true },
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'PLAYING_XI_PLAYER_UPDATED',
      entityType: 'PlayingXI',
      entityId: 'match-1:team-a',
      payload: {
        matchId: 'match-1',
        teamId: 'team-a',
        playerId: 'player-3',
        isCaptain: true,
        isWicketKeeper: false,
      },
    });
    expect(result.isCaptain).toBe(true);
  });

  it('updates wicketkeeper and clears previous wicketkeeper', async () => {
    prismaService.match.findFirst.mockResolvedValue(match);
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });
    prismaService.matchPlayer.findFirst.mockResolvedValue({
      id: 'selection-2',
      matchId: 'match-1',
      teamId: 'team-a',
      playerId: 'player-4',
      isCaptain: false,
      isWicketKeeper: false,
    });
    prismaService.matchPlayer.updateMany.mockResolvedValue({ count: 1 });
    prismaService.matchPlayer.update.mockResolvedValue({
      id: 'selection-2',
      matchId: 'match-1',
      teamId: 'team-a',
      playerId: 'player-4',
      isCaptain: false,
      isWicketKeeper: true,
    });

    const dto: UpdatePlayingXiPlayerDto = { isWicketKeeper: true };
    const result = await service.updatePlayer('match-1', 'team-a', 'player-4', dto);

    expect(prismaService.matchPlayer.updateMany).toHaveBeenCalledWith({
      where: { matchId: 'match-1', teamId: 'team-a', isWicketKeeper: true },
      data: { isWicketKeeper: false },
    });
    expect(prismaService.matchPlayer.update).toHaveBeenCalledWith({
      where: { id: 'selection-2' },
      data: { isWicketKeeper: true },
    });
    expect(result.isWicketKeeper).toBe(true);
  });

  it('removes player from lineup and does not delete player or roster membership', async () => {
    prismaService.match.findFirst.mockResolvedValue(match);
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' });
    prismaService.matchPlayer.findFirst.mockResolvedValue({
      id: 'selection-3',
      matchId: 'match-1',
      teamId: 'team-a',
      playerId: 'player-5',
      isCaptain: false,
      isWicketKeeper: false,
    });
    prismaService.matchPlayer.delete.mockResolvedValue({ id: 'selection-3' });

    const result = await service.removePlayer('match-1', 'team-a', 'player-5');

    expect(prismaService.matchPlayer.delete).toHaveBeenCalledWith({ where: { id: 'selection-3' } });
    expect(prismaService.player.delete).toBeUndefined();
    expect(prismaService.teamPlayer.delete).toBeUndefined();
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'PLAYING_XI_PLAYER_REMOVED',
      entityType: 'PlayingXI',
      entityId: 'match-1:team-a',
      payload: {
        matchId: 'match-1',
        teamId: 'team-a',
        playerId: 'player-5',
      },
    });
    expect(result.id).toBe('selection-3');
  });

  it('blocks lineup changes after match is LIVE', async () => {
    prismaService.match.findFirst.mockResolvedValue({ ...match, status: MatchStatus.LIVE });
    await expect(service.setPlayingXI('match-1', 'team-a', { players })).rejects.toThrow(ConflictException);
    expect(prismaService.matchPlayer.deleteMany).not.toHaveBeenCalled();
  });
});
