import 'reflect-metadata';
import { PlayingXiController } from './playing-xi.controller';
import { RoleName } from '@prisma/client';

describe('PlayingXiController', () => {
  let controller: PlayingXiController;
  let service: any;

  beforeEach(() => {
    service = {
      setPlayingXI: jest.fn(),
      getPlayingXI: jest.fn(),
      updatePlayer: jest.fn(),
      removePlayer: jest.fn(),
    };
    controller = new PlayingXiController(service);
  });

  it('delegates setPlayingXI to service', async () => {
    const dto = { players: [{ playerId: 'player-1', isCaptain: true, isWicketKeeper: false }] };
    service.setPlayingXI.mockResolvedValue({});

    const result = await controller.setPlayingXI('match-1', 'team-a', dto as any);

    expect(result).toEqual({});
    expect(service.setPlayingXI).toHaveBeenCalledWith('match-1', 'team-a', dto);
  });

  it('delegates getPlayingXI to service', async () => {
    service.getPlayingXI.mockResolvedValue([{ playerId: 'player-1' }]);

    const result = await controller.getPlayingXI('match-1', 'team-a');

    expect(result).toEqual([{ playerId: 'player-1' }]);
    expect(service.getPlayingXI).toHaveBeenCalledWith('match-1', 'team-a');
  });

  it('delegates updatePlayer to service', async () => {
    const dto = { isCaptain: true };
    service.updatePlayer.mockResolvedValue({ playerId: 'player-1' });

    const result = await controller.updatePlayer('match-1', 'team-a', 'player-1', dto as any);

    expect(result).toEqual({ playerId: 'player-1' });
    expect(service.updatePlayer).toHaveBeenCalledWith('match-1', 'team-a', 'player-1', dto);
  });

  it('delegates removePlayer to service', async () => {
    service.removePlayer.mockResolvedValue({ id: 'selection-1' });

    const result = await controller.removePlayer('match-1', 'team-a', 'player-1');

    expect(result).toEqual({ id: 'selection-1' });
    expect(service.removePlayer).toHaveBeenCalledWith('match-1', 'team-a', 'player-1');
  });

  it('has RBAC metadata on protected endpoints', () => {
    const prototype = PlayingXiController.prototype;
    const getMethodRoles = (methodName: string) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
      return descriptor ? Reflect.getOwnMetadata('rbac:roles', descriptor.value) : undefined;
    };

    const setRoles = getMethodRoles('setPlayingXI');
    const readRoles = getMethodRoles('getPlayingXI');
    const updateRoles = getMethodRoles('updatePlayer');
    const removeRoles = getMethodRoles('removePlayer');

    expect(setRoles).toContain(RoleName.SUPER_ADMIN);
    expect(setRoles).toContain(RoleName.TENANT_ADMIN);
    expect(setRoles).toContain(RoleName.TEAM_MANAGER);

    expect(readRoles).toContain(RoleName.SCORER);
    expect(readRoles).toContain(RoleName.MEDIA_MANAGER);

    expect(updateRoles).toContain(RoleName.MATCH_REFEREE);
    expect(removeRoles).toContain(RoleName.MATCH_REFEREE);
  });
});
