import 'reflect-metadata';
import { TossController } from './toss.controller';
import { RoleName } from '@prisma/client';

describe('TossController', () => {
  let controller: TossController;
  let service: any;

  beforeEach(() => {
    service = {
      setToss: jest.fn(),
      getToss: jest.fn(),
    };
    controller = new TossController(service);
  });

  it('delegates setToss to service', async () => {
    const dto = { winnerTeamId: 'team-a', decision: 'BAT' };
    service.setToss.mockResolvedValue({ matchId: 'match-1', winnerTeamId: 'team-a', decision: 'BAT' });

    const result = await controller.setToss('match-1', dto as any);

    expect(result).toEqual({ matchId: 'match-1', winnerTeamId: 'team-a', decision: 'BAT' });
    expect(service.setToss).toHaveBeenCalledWith('match-1', dto);
  });

  it('delegates getToss to service', async () => {
    service.getToss.mockResolvedValue({ matchId: 'match-1', winnerTeamId: 'team-a', decision: 'BAT' });

    const result = await controller.getToss('match-1');

    expect(result).toEqual({ matchId: 'match-1', winnerTeamId: 'team-a', decision: 'BAT' });
    expect(service.getToss).toHaveBeenCalledWith('match-1');
  });

  it('has RBAC metadata on protected endpoints', () => {
    const prototype = TossController.prototype;
    const getMethodRoles = (methodName: string) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
      return descriptor ? Reflect.getOwnMetadata('rbac:roles', descriptor.value) : undefined;
    };

    const setRoles = getMethodRoles('setToss');
    const getRoles = getMethodRoles('getToss');

    expect(setRoles).toContain(RoleName.SUPER_ADMIN);
    expect(setRoles).toContain(RoleName.TENANT_ADMIN);
    expect(setRoles).toContain(RoleName.MATCH_REFEREE);

    expect(getRoles).toContain(RoleName.SCORER);
    expect(getRoles).toContain(RoleName.MEDIA_MANAGER);
    expect(getRoles).toContain(RoleName.BROADCAST_USER);
  });
});
