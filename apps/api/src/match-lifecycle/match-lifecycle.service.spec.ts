import { BadRequestException, ConflictException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { MatchLifecycleService } from './match-lifecycle.service';

describe('MatchLifecycleService', () => {
  let service: MatchLifecycleService;
  let prismaService: any;

  beforeEach(() => {
    prismaService = {
      match: {
        findFirst: jest.fn(),
      },
      matchPlayer: {
        count: jest.fn(),
      },
      matchToss: {
        findUnique: jest.fn(),
      },
    };

    service = new MatchLifecycleService(prismaService);
  });

  it('allows known valid transitions', () => {
    expect(service.canTransition(MatchStatus.SCHEDULED, MatchStatus.LIVE)).toBe(true);
    expect(service.canTransition(MatchStatus.LIVE, MatchStatus.COMPLETED)).toBe(true);
    expect(service.canTransition(MatchStatus.SCHEDULED, MatchStatus.ABANDONED)).toBe(true);
  });

  it('rejects arbitrary jumps and terminal reversals', () => {
    expect(service.canTransition(MatchStatus.SCHEDULED, MatchStatus.COMPLETED)).toBe(false);
    expect(service.canTransition(MatchStatus.COMPLETED, MatchStatus.LIVE)).toBe(false);
    expect(service.canTransition(MatchStatus.ABANDONED, MatchStatus.LIVE)).toBe(false);
  });

  it('classifies pre-match, live, and terminal states', () => {
    expect(service.isPreMatch(MatchStatus.SCHEDULED)).toBe(true);
    expect(service.isLive(MatchStatus.LIVE)).toBe(true);
    expect(service.isTerminal(MatchStatus.COMPLETED)).toBe(true);
    expect(service.isTerminal(MatchStatus.CANCELLED)).toBe(true);
  });

  it('allows lineup and toss edits before live and rejects after live', () => {
    expect(service.canEditLineup(MatchStatus.SCHEDULED)).toBe(true);
    expect(service.canEditToss(MatchStatus.SCHEDULED)).toBe(true);
    expect(service.canEditOfficials(MatchStatus.SCHEDULED)).toBe(true);

    expect(service.canEditLineup(MatchStatus.LIVE)).toBe(false);
    expect(service.canEditToss(MatchStatus.LIVE)).toBe(false);
    expect(service.canEditOfficials(MatchStatus.LIVE)).toBe(false);
  });

  it('marks live matches as score-capable only', () => {
    expect(service.canScore(MatchStatus.LIVE)).toBe(true);
    expect(service.canScore(MatchStatus.SCHEDULED)).toBe(false);
    expect(service.canScore(MatchStatus.COMPLETED)).toBe(false);
  });

  it('assertTransitionAllowed throws for invalid move', () => {
    expect(() => service.assertTransitionAllowed(MatchStatus.SCHEDULED, MatchStatus.COMPLETED)).toThrow(BadRequestException);
  });

  it('starts a match only when prerequisites are satisfied', async () => {
    prismaService.match.findFirst.mockResolvedValue({
      id: 'm1',
      tenantId: 'tenant-1',
      homeTeamId: 'team-a',
      awayTeamId: 'team-b',
      playingTeamSize: 8,
      status: MatchStatus.SCHEDULED,
      tournament: { playingTeamSize: 8 },
    });
    prismaService.matchPlayer.count.mockResolvedValue(8);
    prismaService.matchToss.findUnique.mockResolvedValue({
      matchId: 'm1',
      winnerTeamId: 'team-a',
      decision: 'BAT',
    });

    await expect(
      service.assertCanStartMatch({
        matchId: 'm1',
        tenantId: 'tenant-1',
        tournament: { id: 't1', playingTeamSize: 8 },
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects starting a match when a lineup is incomplete', async () => {
    prismaService.match.findFirst.mockResolvedValue({
      id: 'm1',
      tenantId: 'tenant-1',
      homeTeamId: 'team-a',
      awayTeamId: 'team-b',
      playingTeamSize: null,
      status: MatchStatus.SCHEDULED,
      tournament: { playingTeamSize: 11 },
    });
    prismaService.matchPlayer.count.mockResolvedValueOnce(10).mockResolvedValueOnce(11);

    await expect(
      service.assertCanStartMatch({
        matchId: 'm1',
        tenantId: 'tenant-1',
        tournament: { id: 't1', playingTeamSize: 11 },
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('supports tournament-configured lineup size override', async () => {
    prismaService.match.findFirst.mockResolvedValue({
      id: 'm1',
      tenantId: 'tenant-1',
      homeTeamId: 'team-a',
      awayTeamId: 'team-b',
      playingTeamSize: 12,
      status: MatchStatus.SCHEDULED,
      tournament: { playingTeamSize: 11 },
    });
    prismaService.matchPlayer.count.mockResolvedValue(12);
    prismaService.matchToss.findUnique.mockResolvedValue({
      winnerTeamId: 'team-a',
      decision: 'BAT',
    });

    await expect(
      service.assertCanStartMatch({
        matchId: 'm1',
        tenantId: 'tenant-1',
        tournament: { id: 't1', playingTeamSize: 11 },
      }),
    ).resolves.toBeUndefined();
  });
});
