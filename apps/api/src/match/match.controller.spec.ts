import 'reflect-metadata';
import { MatchController } from './match.controller';
import { RoleName } from '@prisma/client';

describe('MatchController', () => {
  let controller: MatchController;
  let service: any;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
    };
    controller = new MatchController(service);
  });

  it('delegates create to service', async () => {
    const dto = {
      tournamentId: 'tournament-1',
      homeTeamId: 'team-a',
      awayTeamId: 'team-b',
      status: 'SCHEDULED',
    };

    service.create.mockResolvedValue({ id: 'match-1', ...dto });

    const result = await controller.create(dto as any);

    expect(result).toEqual({ id: 'match-1', ...dto });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates findAll to service', async () => {
    service.findAll.mockResolvedValue([{ id: 'match-1' }]);

    const result = await controller.findAll();

    expect(result).toEqual([{ id: 'match-1' }]);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('delegates findById to service', async () => {
    service.findById.mockResolvedValue({ id: 'match-1' });

    const result = await controller.findById('match-1');

    expect(result).toEqual({ id: 'match-1' });
    expect(service.findById).toHaveBeenCalledWith('match-1');
  });

  it('delegates update to service', async () => {
    const dto = { venueId: 'venue-1' };
    service.update.mockResolvedValue({ id: 'match-1', ...dto });

    const result = await controller.update('match-1', dto as any);

    expect(result).toEqual({ id: 'match-1', ...dto });
    expect(service.update).toHaveBeenCalledWith('match-1', dto);
  });

  it('delegates updateStatus to service', async () => {
    const dto = { status: 'LIVE' };
    service.updateStatus.mockResolvedValue({ id: 'match-1', status: 'LIVE' });

    const result = await controller.updateStatus('match-1', dto as any);

    expect(result).toEqual({ id: 'match-1', status: 'LIVE' });
    expect(service.updateStatus).toHaveBeenCalledWith('match-1', dto);
  });

  it('has RBAC metadata on protected endpoints', () => {
    const prototype = MatchController.prototype;
    const getMethodRoles = (methodName: string) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
      return descriptor ? Reflect.getOwnMetadata('rbac:roles', descriptor.value) : undefined;
    };

    const createRoles = getMethodRoles('create');
    const updateRoles = getMethodRoles('update');
    const statusRoles = getMethodRoles('updateStatus');
    const readRoles = getMethodRoles('findAll');
    const readByIdRoles = getMethodRoles('findById');

    expect(createRoles).toContain(RoleName.SUPER_ADMIN);
    expect(createRoles).toContain(RoleName.TENANT_ADMIN);
    expect(createRoles).toContain(RoleName.TOURNAMENT_ADMIN);

    expect(updateRoles).toContain(RoleName.MATCH_REFEREE);
    expect(statusRoles).toContain(RoleName.MATCH_REFEREE);

    expect(readRoles).toContain(RoleName.SCORER);
    expect(readRoles).toContain(RoleName.UMPIRE);
    expect(readByIdRoles).toContain(RoleName.MEDIA_MANAGER);
  });
});
