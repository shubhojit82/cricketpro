import 'reflect-metadata';
import { MatchEventController } from './match-event.controller';
import { AppendMatchEventDto } from './dto/append-match-event.dto';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('MatchEventController', () => {
  let controller: MatchEventController;
  let matchEventService: any;
  let tenantContext: any;
  let matchService: any;
  let lifecycle: any;
  let auditLog: any;

  beforeEach(() => {
    matchEventService = {
      getByClientEventId: jest.fn(),
      appendEvent: jest.fn(),
      getEventsForMatch: jest.fn(),
      getEventById: jest.fn(),
    };

    tenantContext = { getTenantId: jest.fn().mockReturnValue('tenant-1') };

    matchService = { findById: jest.fn() };

    lifecycle = { isTerminal: jest.fn().mockReturnValue(false) };

    auditLog = { record: jest.fn().mockResolvedValue(null) };

    controller = new MatchEventController(
      matchEventService,
      tenantContext,
      matchService,
      lifecycle,
      auditLog,
    );
  });

  it('appends a new event successfully and audits', async () => {
    const dto: AppendMatchEventDto = {
      eventType: 'TEST',
      clientEventId: 'client-1',
    } as any;

    matchService.findById.mockResolvedValue({ id: 'match-1', tenantId: 'tenant-1', tournamentId: 'tourn-1', status: 'SCHEDULED' });
    matchEventService.getByClientEventId.mockResolvedValue(null);
    matchEventService.appendEvent.mockResolvedValue({ id: 'event-1', clientEventId: 'client-1', eventType: 'TEST' });

    const res = await controller.append('match-1', dto);

    expect(matchEventService.appendEvent).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', matchId: 'match-1', tournamentId: 'tourn-1' }));
    expect(auditLog.record).toHaveBeenCalled();
    expect(res).toHaveProperty('id', 'event-1');
  });

  it('returns existing event for idempotent replay and does not audit', async () => {
    const dto: AppendMatchEventDto = { eventType: 'TEST', clientEventId: 'client-1' } as any;
    matchService.findById.mockResolvedValue({ id: 'match-1', tenantId: 'tenant-1', tournamentId: 'tourn-1', status: 'SCHEDULED' });
    const existing = { id: 'event-1', clientEventId: 'client-1' };
    matchEventService.getByClientEventId.mockResolvedValue(existing);

    const res = await controller.append('match-1', dto);

    expect(res).toBe(existing);
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('rejects append when match is terminal', async () => {
    lifecycle.isTerminal.mockReturnValue(true);
    matchService.findById.mockResolvedValue({ id: 'match-1', tenantId: 'tenant-1', tournamentId: 'tourn-1', status: 'COMPLETED' });

    await expect(controller.append('match-1', { eventType: 'x', clientEventId: 'c1' } as any)).rejects.toThrow(ConflictException);
  });

  it('GET collection delegates to service with tenant', async () => {
    matchEventService.getEventsForMatch.mockResolvedValue([{ id: 'e1', sequenceNumber: 1 }]);
    const res = await controller.findAll('match-1');
    expect(matchEventService.getEventsForMatch).toHaveBeenCalledWith('match-1', 'tenant-1');
    expect(res).toEqual([{ id: 'e1', sequenceNumber: 1 }]);
  });

  it('GET one returns event when belongs to match and tenant', async () => {
    matchEventService.getEventById.mockResolvedValue({ id: 'e1', matchId: 'match-1', tenantId: 'tenant-1' });
    const res = await controller.findOne('match-1', 'e1');
    expect(res).toEqual({ id: 'e1', matchId: 'match-1', tenantId: 'tenant-1' });
  });

  it('GET one rejects cross-match or cross-tenant', async () => {
    matchEventService.getEventById.mockResolvedValue({ id: 'e1', matchId: 'match-2', tenantId: 'tenant-1' });
    await expect(controller.findOne('match-1', 'e1')).rejects.toThrow(NotFoundException);
    matchEventService.getEventById.mockResolvedValue({ id: 'e2', matchId: 'match-1', tenantId: 'tenant-2' });
    await expect(controller.findOne('match-1', 'e2')).rejects.toThrow(NotFoundException);
  });
});
