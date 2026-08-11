import 'reflect-metadata';
import { VenueController } from './venue.controller';
import { RoleName } from '@prisma/client';

describe('VenueController', () => {
  let controller: VenueController;
  let service: any;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };
    controller = new VenueController(service);
  });

  it('delegates create to service', async () => {
    const dto = { name: 'Wankhede', city: 'Mumbai', country: 'India' };
    service.create.mockResolvedValue({ id: 'venue-1', tenantId: 'tenant-1', ...dto });

    const result = await controller.create(dto as any);

    expect(result).toEqual({ id: 'venue-1', tenantId: 'tenant-1', ...dto });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates findAll to service', async () => {
    service.findAll.mockResolvedValue([{ id: 'venue-1' }]);

    const result = await controller.findAll();

    expect(result).toEqual([{ id: 'venue-1' }]);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('delegates findById to service', async () => {
    service.findById.mockResolvedValue({ id: 'venue-1' });

    const result = await controller.findById('venue-1');

    expect(result).toEqual({ id: 'venue-1' });
    expect(service.findById).toHaveBeenCalledWith('venue-1');
  });

  it('delegates update to service', async () => {
    const dto = { name: 'Updated Venue', city: 'Delhi' };
    service.update.mockResolvedValue({ id: 'venue-1', tenantId: 'tenant-1', ...dto });

    const result = await controller.update('venue-1', dto as any);

    expect(result).toEqual({ id: 'venue-1', tenantId: 'tenant-1', ...dto });
    expect(service.update).toHaveBeenCalledWith('venue-1', dto);
  });

  it('has RBAC metadata on protected endpoints', () => {
    const prototype = VenueController.prototype;
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

    expect(updateRoles).toContain(RoleName.SUPER_ADMIN);
    expect(updateRoles).toContain(RoleName.TENANT_ADMIN);
    expect(updateRoles).toContain(RoleName.TOURNAMENT_ADMIN);

    expect(readRoles).toContain(RoleName.SCORER);
    expect(readRoles).toContain(RoleName.UMPIRE);
    expect(readByIdRoles).toContain(RoleName.MEDIA_MANAGER);
  });
});
