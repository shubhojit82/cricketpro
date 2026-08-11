import { Prisma } from '@prisma/client';
import { MatchEventService } from './match-event.service';
import {
  MatchEventAppendInput,
  MatchEventConflictError,
  MatchEventNotFoundError,
  MatchEventValidationError,
} from './match-event.types';

describe('MatchEventService', () => {
  let service: MatchEventService;
  let prismaService: any;
  let tenantContext: any;

  beforeEach(() => {
    prismaService = {
      tenant: { findUnique: jest.fn() },
      tournament: { findUnique: jest.fn() },
      match: { findUnique: jest.fn() },
      matchEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    tenantContext = {
      getTenantId: jest.fn().mockReturnValue('tenant-1'),
    };

    prismaService.$transaction.mockImplementation(async (callback: any) =>
      callback(prismaService),
    );

    service = new MatchEventService(prismaService, tenantContext);
  });

  const baseInput: MatchEventAppendInput = {
    tenantId: 'tenant-1',
    tournamentId: 'tournament-1',
    matchId: 'match-1',
    eventType: 'TEST_EVENT',
    sequenceNumber: 1,
    payload: { a: 1 },
    clientEventId: 'client-1',
  };

  const matchingTournament = {
    id: 'tournament-1',
    tenantId: 'tenant-1',
  };

  const matchingMatch = {
    id: 'match-1',
    tenantId: 'tenant-1',
    tournamentId: 'tournament-1',
  };

  it('appends a new event successfully', async () => {
    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.tournament.findUnique.mockResolvedValue(matchingTournament);
    prismaService.match.findUnique.mockResolvedValue(matchingMatch);
    prismaService.matchEvent.findUnique.mockResolvedValue(null);
    prismaService.matchEvent.create.mockResolvedValue({
      id: 'event-1',
      ...baseInput,
      createdAt: new Date(),
    });

    const result = await service.appendEvent(baseInput);

    expect(result.id).toBe('event-1');
    expect(prismaService.matchEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        clientEventId: 'client-1',
      }),
    });
  });

  it('returns existing event for duplicate clientEventId', async () => {
    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.tournament.findUnique.mockResolvedValue(matchingTournament);
    prismaService.match.findUnique.mockResolvedValue(matchingMatch);
    const existingEvent = {
      id: 'event-1',
      ...baseInput,
      createdAt: new Date(),
    };
    prismaService.matchEvent.findUnique.mockResolvedValue(existingEvent);

    const result = await service.appendEvent(baseInput);

    expect(result).toBe(existingEvent);
    expect(prismaService.matchEvent.create).not.toHaveBeenCalled();
  });

  it('throws conflict when sequence number already exists', async () => {
    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.tournament.findUnique.mockResolvedValue(matchingTournament);
    prismaService.match.findUnique.mockResolvedValue(matchingMatch);
    prismaService.matchEvent.findUnique.mockResolvedValue(null);
    const error = new Error('Unique constraint failure') as Prisma.PrismaClientKnownRequestError;
    error.code = 'P2002';
    error.meta = { target: ['matchId', 'sequenceNumber'] } as any;
    prismaService.matchEvent.create.mockRejectedValue(error);

    await expect(service.appendEvent(baseInput)).rejects.toThrow(
      MatchEventConflictError,
    );
  });

  it('throws not found when tenant does not exist', async () => {
    prismaService.tenant.findUnique.mockResolvedValue(null);

    await expect(service.appendEvent(baseInput)).rejects.toThrow(
      MatchEventNotFoundError,
    );
  });

  it('throws validation error when tournament does not belong to tenant', async () => {
    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.tournament.findUnique.mockResolvedValue({
      id: 'tournament-1',
      tenantId: 'tenant-2',
    });

    await expect(service.appendEvent(baseInput)).rejects.toThrow(
      MatchEventValidationError,
    );
  });

  it('throws validation error when match does not belong to tournament', async () => {
    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.tournament.findUnique.mockResolvedValue(matchingTournament);
    prismaService.match.findUnique.mockResolvedValue({
      id: 'match-1',
      tenantId: 'tenant-1',
      tournamentId: 'tournament-2',
    });

    await expect(service.appendEvent(baseInput)).rejects.toThrow(
      MatchEventValidationError,
    );
  });

  it('throws validation error when match belongs to different tenant', async () => {
    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.tournament.findUnique.mockResolvedValue(matchingTournament);
    prismaService.match.findUnique.mockResolvedValue({
      id: 'match-1',
      tenantId: 'tenant-2',
      tournamentId: 'tournament-1',
    });

    await expect(service.appendEvent(baseInput)).rejects.toThrow(
      MatchEventValidationError,
    );
  });

  it('appends with valid supersedesEventId', async () => {
    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.tournament.findUnique.mockResolvedValue(matchingTournament);
    prismaService.match.findUnique.mockResolvedValue(matchingMatch);
    prismaService.matchEvent.findUnique
      .mockResolvedValueOnce({
        id: 'superseded-1',
        tenantId: 'tenant-1',
        matchId: 'match-1',
        createdAt: new Date(),
        clientEventId: 'existing-client-1',
        sequenceNumber: 1,
        eventType: 'OLD_EVENT',
        payload: {},
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaService.matchEvent.create.mockResolvedValue({
      id: 'event-2',
      ...baseInput,
      supersedesEventId: 'superseded-1',
      createdAt: new Date(),
    });

    const result = await service.appendEvent({
      ...baseInput,
      supersedesEventId: 'superseded-1',
    });

    expect(result.id).toBe('event-2');
    expect(prismaService.matchEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        supersedesEventId: 'superseded-1',
      }),
    });
  });

  it('rejects supersedesEventId from a different tenant', async () => {
    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.tournament.findUnique.mockResolvedValue(matchingTournament);
    prismaService.match.findUnique.mockResolvedValue(matchingMatch);
    prismaService.matchEvent.findUnique
      .mockResolvedValueOnce({
        id: 'superseded-1',
        tenantId: 'tenant-2',
        matchId: 'match-1',
        createdAt: new Date(),
        clientEventId: 'existing-client-1',
        sequenceNumber: 1,
        eventType: 'OLD_EVENT',
        payload: {},
      });

    await expect(
      service.appendEvent({
        ...baseInput,
        supersedesEventId: 'superseded-1',
      }),
    ).rejects.toThrow(MatchEventValidationError);
  });

  it('rejects supersedesEventId from a different match', async () => {
    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.tournament.findUnique.mockResolvedValue(matchingTournament);
    prismaService.match.findUnique.mockResolvedValue(matchingMatch);
    prismaService.matchEvent.findUnique
      .mockResolvedValueOnce({
        id: 'superseded-1',
        tenantId: 'tenant-1',
        matchId: 'match-2',
        createdAt: new Date(),
        clientEventId: 'existing-client-1',
        sequenceNumber: 1,
        eventType: 'OLD_EVENT',
        payload: {},
      });

    await expect(
      service.appendEvent({
        ...baseInput,
        supersedesEventId: 'superseded-1',
      }),
    ).rejects.toThrow(MatchEventValidationError);
  });

  it('preserves old event data unchanged', async () => {
    const supersededEvent = {
      id: 'superseded-1',
      tenantId: 'tenant-1',
      matchId: 'match-1',
      createdAt: new Date(),
      clientEventId: 'existing-client-1',
      sequenceNumber: 1,
      eventType: 'OLD_EVENT',
      payload: { original: true },
    };

    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.tournament.findUnique.mockResolvedValue(matchingTournament);
    prismaService.match.findUnique.mockResolvedValue(matchingMatch);
    prismaService.matchEvent.findUnique
      .mockResolvedValueOnce(supersededEvent)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaService.matchEvent.create.mockResolvedValue({
      id: 'event-2',
      ...baseInput,
      supersedesEventId: 'superseded-1',
      createdAt: new Date(),
    });

    await service.appendEvent({
      ...baseInput,
      supersedesEventId: 'superseded-1',
    });

    expect(supersededEvent.payload).toEqual({ original: true });
    expect(supersededEvent.eventType).toBe('OLD_EVENT');
  });

  it('preserves correlationId when provided', async () => {
    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.tournament.findUnique.mockResolvedValue(matchingTournament);
    prismaService.match.findUnique.mockResolvedValue(matchingMatch);
    prismaService.matchEvent.findUnique.mockResolvedValue(null);
    prismaService.matchEvent.create.mockResolvedValue({
      id: 'event-1',
      ...baseInput,
      correlationId: 'corr-1',
      createdAt: new Date(),
    });

    const result = await service.appendEvent({
      ...baseInput,
      correlationId: 'corr-1',
    });

    expect(result.correlationId).toBe('corr-1');
  });
});
