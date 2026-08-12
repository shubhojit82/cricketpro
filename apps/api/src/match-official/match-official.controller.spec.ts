import 'reflect-metadata';
import { MatchOfficialController } from './match-official.controller';
import { RoleName } from '@prisma/client';

describe('MatchOfficialController', () => {
  let controller: MatchOfficialController;
  let service: any;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new MatchOfficialController(service);
  });

  it('delegates list to service', async () => {
    service.findAll.mockResolvedValue([{ id: 'o1' }]);

    const result = await controller.findAll('match-1');

    expect(result).toEqual([{ id: 'o1' }]);
    expect(service.findAll).toHaveBeenCalledWith('match-1');
  });

  it('delegates get by id to service', async () => {
    service.findById.mockResolvedValue({ id: 'o1' });

    const result = await controller.findById('match-1', 'o1');

    expect(result).toEqual({ id: 'o1' });
    expect(service.findById).toHaveBeenCalledWith('match-1', 'o1');
  });

  it('delegates create to service', async () => {
    const dto = { role: 'UMPIRE', name: 'S. Sharma' };
    service.create.mockResolvedValue({ id: 'o1', ...dto });

    const result = await controller.create('match-1', dto as any);

    expect(result).toEqual({ id: 'o1', ...dto });
    expect(service.create).toHaveBeenCalledWith('match-1', dto);
  });

  it('delegates update to service', async () => {
    const dto = { name: 'R. Sharma' };
    service.update.mockResolvedValue({ id: 'o1', ...dto });

    const result = await controller.update('match-1', 'o1', dto as any);

    expect(result).toEqual({ id: 'o1', ...dto });
    expect(service.update).toHaveBeenCalledWith('match-1', 'o1', dto);
  });

  it('delegates remove to service', async () => {
    service.remove.mockResolvedValue({ id: 'o1' });

    const result = await controller.remove('match-1', 'o1');

    expect(result).toEqual({ id: 'o1' });
    expect(service.remove).toHaveBeenCalledWith('match-1', 'o1');
  });

  it('has RBAC metadata on protected endpoints', () => {
    const prototype = MatchOfficialController.prototype;
    const getMethodRoles = (methodName: string) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
      return descriptor
        ? Reflect.getOwnMetadata('rbac:roles', descriptor.value)
        : undefined;
    };

    const createRoles = getMethodRoles('create');
    const updateRoles = getMethodRoles('update');
    const removeRoles = getMethodRoles('remove');
    const listRoles = getMethodRoles('findAll');
    const readByIdRoles = getMethodRoles('findById');

    expect(createRoles).toContain(RoleName.SUPER_ADMIN);
    expect(createRoles).toContain(RoleName.TENANT_ADMIN);
    expect(createRoles).toContain(RoleName.TOURNAMENT_ADMIN);
    expect(createRoles).toContain(RoleName.MATCH_REFEREE);

    expect(updateRoles).toContain(RoleName.MATCH_REFEREE);
    expect(removeRoles).toContain(RoleName.MATCH_REFEREE);

    expect(listRoles).toContain(RoleName.SCORER);
    expect(listRoles).toContain(RoleName.UMPIRE);
    expect(readByIdRoles).toContain(RoleName.MEDIA_MANAGER);
  });
});
