import 'reflect-metadata';
import { RosterController } from './roster.controller';
import { RoleName } from '@prisma/client';

describe('RosterController', () => {
  let controller: RosterController;
  let service: any;

  beforeEach(() => {
    service = {
      addPlayer: jest.fn(),
      listPlayers: jest.fn(),
      removePlayer: jest.fn(),
    };
    controller = new RosterController(service);
  });

  it('delegates addPlayer to service', async () => {
    const dto = { playerId: 'player-1' };
    service.addPlayer.mockResolvedValue({ id: 'roster-1', teamId: 'team-1', playerId: 'player-1' });

    const result = await controller.addPlayer('team-1', dto as any);

    expect(result).toEqual({ id: 'roster-1', teamId: 'team-1', playerId: 'player-1' });
    expect(service.addPlayer).toHaveBeenCalledWith('team-1', 'player-1');
  });

  it('delegates listPlayers to service', async () => {
    service.listPlayers.mockResolvedValue([{ id: 'player-1' }]);

    const result = await controller.listPlayers('team-1');

    expect(result).toEqual([{ id: 'player-1' }]);
    expect(service.listPlayers).toHaveBeenCalledWith('team-1');
  });

  it('delegates removePlayer to service', async () => {
    service.removePlayer.mockResolvedValue({ id: 'roster-1' });

    const result = await controller.removePlayer('team-1', 'player-1');

    expect(result).toEqual({ id: 'roster-1' });
    expect(service.removePlayer).toHaveBeenCalledWith('team-1', 'player-1');
  });

  it('has RBAC metadata on protected endpoints', () => {
    const prototype = RosterController.prototype;
    const getMethodRoles = (methodName: string) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
      return descriptor ? Reflect.getOwnMetadata('rbac:roles', descriptor.value) : undefined;
    };

    const addRoles = getMethodRoles('addPlayer');
    const deleteRoles = getMethodRoles('removePlayer');
    const listRoles = getMethodRoles('listPlayers');

    expect(addRoles).toContain(RoleName.SUPER_ADMIN);
    expect(addRoles).toContain(RoleName.TEAM_MANAGER);

    expect(deleteRoles).toContain(RoleName.SUPER_ADMIN);
    expect(deleteRoles).toContain(RoleName.TEAM_MANAGER);

    expect(listRoles).toContain(RoleName.SCORER);
    expect(listRoles).toContain(RoleName.UMPIRE);
    expect(listRoles).toContain(RoleName.MEDIA_MANAGER);
  });
});
