import 'reflect-metadata';
import { TeamController } from './team.controller';
import { RoleName } from '@prisma/client';

describe('TeamController', () => {
  let controller: TeamController;
  let service: any;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };
    controller = new TeamController(service);
  });

  it('delegates create to service', async () => {
    const dto = { name: 'Team', shortName: 'T' };
    service.create.mockResolvedValue({ id: 't1', ...dto });

    const result = await controller.create(dto as any);

    expect(result).toEqual({ id: 't1', ...dto });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates findAll to service', async () => {
    service.findAll.mockResolvedValue([{ id: 't1' }]);

    const result = await controller.findAll();

    expect(result).toEqual([{ id: 't1' }]);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('delegates findById to service', async () => {
    service.findById.mockResolvedValue({ id: 't1' });

    const result = await controller.findById('t1');

    expect(result).toEqual({ id: 't1' });
    expect(service.findById).toHaveBeenCalledWith('t1');
  });

  it('delegates update to service', async () => {
    const dto = { name: 'Updated' };
    service.update.mockResolvedValue({ id: 't1', ...dto });

    const result = await controller.update('t1', dto as any);

    expect(result).toEqual({ id: 't1', ...dto });
    expect(service.update).toHaveBeenCalledWith('t1', dto);
  });

  it('has RBAC metadata on protected endpoints', () => {
    const prototype = TeamController.prototype;
    const getMethodRoles = (methodName: string) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
      return descriptor ? Reflect.getOwnMetadata('rbac:roles', descriptor.value) : undefined;
    };

    const createRoles = getMethodRoles('create');
    const updateRoles = getMethodRoles('update');
    const readRoles = getMethodRoles('findAll');
    const readByIdRoles = getMethodRoles('findById');

    expect(createRoles).toContain(RoleName.SUPER_ADMIN);
    expect(createRoles).toContain(RoleName.TENANT_ADMIN);
    expect(createRoles).toContain(RoleName.TOURNAMENT_ADMIN);
    expect(createRoles).toContain(RoleName.TEAM_MANAGER);

    expect(updateRoles).toContain(RoleName.SUPER_ADMIN);
    expect(updateRoles).toContain(RoleName.TENANT_ADMIN);
    expect(updateRoles).toContain(RoleName.TOURNAMENT_ADMIN);
    expect(updateRoles).toContain(RoleName.TEAM_MANAGER);

    expect(readRoles).toContain(RoleName.SCORER);
    expect(readRoles).toContain(RoleName.UMPIRE);
    expect(readByIdRoles).toContain(RoleName.MEDIA_MANAGER);
  });
});
