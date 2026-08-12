import { ConflictException, NotFoundException } from '@nestjs/common';
import { MatchStatus, TossDecision } from '@prisma/client';
import { TossService } from './toss.service';
import { SetTossDto } from './dto/set-toss.dto';

describe('TossService', () => {
  let service: TossService;
  let prismaService: any;
  let tenantContext: any;
  let auditLogService: any;

  const match = {
    id: 'match-1',
    tenantId: 'tenant-1',
    homeTeamId: 'team-a',
    awayTeamId: 'team-b',
    status: MatchStatus.SCHEDULED,
    playingTeamSize: null,
    tournament: {
      playingTeamSize: 11,
    },
  };

  beforeEach(() => {
    prismaService = {
      match: {
        findFirst: jest.fn().mockResolvedValue(match),
      },
      team: {
        findFirst: jest.fn().mockResolvedValue({ id: 'team-a', tenantId: 'tenant-1' }),
      },
      matchPlayer: {
        count: jest.fn().mockResolvedValue(11),
      },
      matchToss: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    tenantContext = {
      getTenantId: jest.fn().mockReturnValue('tenant-1'),
    };
    auditLogService = {
      record: jest.fn().mockResolvedValue({}),
    };
    service = new TossService(prismaService, tenantContext, auditLogService);
  });

  it('sets toss successfully and emits audit log', async () => {
    prismaService.matchToss.create.mockResolvedValue({
      matchId: 'match-1',
      winnerTeamId: 'team-a',
      decision: TossDecision.BAT,
    });

    const dto: SetTossDto = {
      winnerTeamId: 'team-a',
      decision: TossDecision.BAT,
    };

    const result = await service.setToss('match-1', dto);

    expect(prismaService.matchToss.create).toHaveBeenCalledWith({
      data: {
        matchId: 'match-1',
        winnerTeamId: 'team-a',
        decision: TossDecision.BAT,
      },
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'MATCH_TOSS_SET',
      entityType: 'MatchToss',
      entityId: 'match-1',
      payload: {
        matchId: 'match-1',
        winnerTeamId: 'team-a',
        decision: TossDecision.BAT,
      },
    });
    expect(result.decision).toBe(TossDecision.BAT);
  });

  it('uses tenantId from TenantContextService', async () => {
    tenantContext.getTenantId.mockReturnValue('tenant-2');
    prismaService.match.findFirst.mockResolvedValue({ ...match, tenantId: 'tenant-2' });
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-a', tenantId: 'tenant-2' });
    prismaService.matchToss.create.mockResolvedValue({
      matchId: 'match-1',
      winnerTeamId: 'team-a',
      decision: TossDecision.BOWL,
    });

    await service.setToss('match-1', { winnerTeamId: 'team-a', decision: TossDecision.BOWL });

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
    await expect(service.setToss('match-1', { winnerTeamId: 'team-a', decision: TossDecision.BAT })).rejects.toThrow(NotFoundException);
  });

  it('throws when winner team does not belong to tenant', async () => {
    prismaService.team.findFirst.mockResolvedValue(null);
    await expect(service.setToss('match-1', { winnerTeamId: 'team-c', decision: TossDecision.BAT })).rejects.toThrow(NotFoundException);
  });

  it('throws when winner team does not participate in match', async () => {
    prismaService.team.findFirst.mockResolvedValue({ id: 'team-c', tenantId: 'tenant-1' });
    await expect(service.setToss('match-1', { winnerTeamId: 'team-c', decision: TossDecision.BAT })).rejects.toThrow(ConflictException);
  });

  it('throws when lineups are incomplete before toss', async () => {
    prismaService.matchPlayer.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(11);

    await expect(service.setToss('match-1', { winnerTeamId: 'team-a', decision: TossDecision.BAT })).rejects.toThrow(ConflictException);
    expect(prismaService.matchPlayer.count).toHaveBeenCalledWith({
      where: { matchId: 'match-1', teamId: 'team-a' },
    });
    expect(prismaService.matchPlayer.count).toHaveBeenCalledWith({
      where: { matchId: 'match-1', teamId: 'team-b' },
    });
  });

  it('accepts toss when tournament config requires 8 players for each lineup', async () => {
    const matchWithConfig = {
      ...match,
      playingTeamSize: null,
      tournament: { playingTeamSize: 8 },
    };
    prismaService.match.findFirst.mockResolvedValue(matchWithConfig);
    prismaService.matchPlayer.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(8);
    prismaService.matchToss.create.mockResolvedValue({
      matchId: 'match-1',
      winnerTeamId: 'team-a',
      decision: TossDecision.BAT,
    });

    const result = await service.setToss('match-1', { winnerTeamId: 'team-a', decision: TossDecision.BAT });

    expect(result.decision).toBe(TossDecision.BAT);
  });

  it('accepts toss when match override requires 6 players for each lineup', async () => {
    const matchWithOverride = {
      ...match,
      playingTeamSize: 6,
      tournament: { playingTeamSize: 11 },
    };
    prismaService.match.findFirst.mockResolvedValue(matchWithOverride);
    prismaService.matchPlayer.count
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(6);
    prismaService.matchToss.create.mockResolvedValue({
      matchId: 'match-1',
      winnerTeamId: 'team-a',
      decision: TossDecision.BOWL,
    });

    const result = await service.setToss('match-1', { winnerTeamId: 'team-a', decision: TossDecision.BOWL });

    expect(result.decision).toBe(TossDecision.BOWL);
  });

  it('accepts BAT decision', async () => {
    prismaService.matchToss.create.mockResolvedValue({
      matchId: 'match-1',
      winnerTeamId: 'team-a',
      decision: TossDecision.BAT,
    });

    const result = await service.setToss('match-1', { winnerTeamId: 'team-a', decision: TossDecision.BAT });

    expect(result.decision).toBe(TossDecision.BAT);
  });

  it('accepts BOWL decision', async () => {
    prismaService.matchToss.create.mockResolvedValue({
      matchId: 'match-1',
      winnerTeamId: 'team-a',
      decision: TossDecision.BOWL,
    });

    const result = await service.setToss('match-1', { winnerTeamId: 'team-a', decision: TossDecision.BOWL });

    expect(result.decision).toBe(TossDecision.BOWL);
  });

  it('gets toss successfully', async () => {
    prismaService.matchToss.findUnique.mockResolvedValue({
      matchId: 'match-1',
      winnerTeamId: 'team-a',
      decision: TossDecision.BAT,
    });

    const result = await service.getToss('match-1');

    expect(result.winnerTeamId).toBe('team-a');
  });

  it('throws NotFoundException when toss does not exist', async () => {
    prismaService.matchToss.findUnique.mockResolvedValue(null);
    await expect(service.getToss('match-1')).rejects.toThrow(NotFoundException);
  });

  it('is idempotent when same toss is repeated', async () => {
    prismaService.matchToss.findUnique.mockResolvedValue({
      matchId: 'match-1',
      winnerTeamId: 'team-a',
      decision: TossDecision.BAT,
    });

    const result = await service.setToss('match-1', { winnerTeamId: 'team-a', decision: TossDecision.BAT });

    expect(prismaService.matchToss.update).not.toHaveBeenCalled();
    expect(result.decision).toBe(TossDecision.BAT);
  });

  it('rejects conflicting toss overwrite when match is live', async () => {
    prismaService.match.findFirst.mockResolvedValue({ ...match, status: MatchStatus.LIVE });
    prismaService.matchToss.findUnique.mockResolvedValue({
      matchId: 'match-1',
      winnerTeamId: 'team-a',
      decision: TossDecision.BAT,
    });

    await expect(service.setToss('match-1', { winnerTeamId: 'team-a', decision: TossDecision.BOWL })).rejects.toThrow(ConflictException);
  });

  it('rejects conflicting toss overwrite when match is completed', async () => {
    prismaService.match.findFirst.mockResolvedValue({ ...match, status: MatchStatus.COMPLETED });
    prismaService.matchToss.findUnique.mockResolvedValue({
      matchId: 'match-1',
      winnerTeamId: 'team-a',
      decision: TossDecision.BAT,
    });

    await expect(service.setToss('match-1', { winnerTeamId: 'team-a', decision: TossDecision.BOWL })).rejects.toThrow(ConflictException);
  });

  it('emits MATCH_TOSS_UPDATED when updating toss before live', async () => {
    prismaService.matchToss.findUnique.mockResolvedValue({
      matchId: 'match-1',
      winnerTeamId: 'team-a',
      decision: TossDecision.BAT,
    });
    prismaService.matchToss.update.mockResolvedValue({
      matchId: 'match-1',
      winnerTeamId: 'team-a',
      decision: TossDecision.BOWL,
    });

    const result = await service.setToss('match-1', { winnerTeamId: 'team-a', decision: TossDecision.BOWL });

    expect(prismaService.matchToss.update).toHaveBeenCalledWith({
      where: { matchId: 'match-1' },
      data: { winnerTeamId: 'team-a', decision: TossDecision.BOWL },
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'MATCH_TOSS_UPDATED',
      entityType: 'MatchToss',
      entityId: 'match-1',
      payload: {
        matchId: 'match-1',
        winnerTeamId: 'team-a',
        decision: TossDecision.BOWL,
        previousWinnerTeamId: 'team-a',
        previousDecision: TossDecision.BAT,
      },
    });
    expect(result.decision).toBe(TossDecision.BOWL);
  });
});
