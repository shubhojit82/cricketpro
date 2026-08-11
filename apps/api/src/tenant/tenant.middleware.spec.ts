import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenantContextService } from './tenant-context.service';
import { TenantMiddleware } from './tenant.middleware';
import type { TenantService } from './tenant.service';

describe('TenantMiddleware', () => {
  let tenantService: jest.Mocked<TenantService>;
  let tenantContext: TenantContextService;
  let middleware: TenantMiddleware;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    tenantService = {
      validateTenant: jest.fn(),
    } as unknown as jest.Mocked<TenantService>;

    tenantContext = new TenantContextService();
    middleware = new TenantMiddleware(tenantService, tenantContext);
    next = jest.fn();
  });

  it('throws BadRequestException when header is missing', async () => {
    const req = { headers: {} } as unknown as Request;

    await expect(
      middleware.use(req, {} as Response, next),
    ).rejects.toThrow(BadRequestException);
    expect(next).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when header is empty', async () => {
    const req = { headers: { 'x-tenant-id': '   ' } } as unknown as Request;

    await expect(
      middleware.use(req, {} as Response, next),
    ).rejects.toThrow(BadRequestException);
    expect(next).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when tenant does not exist', async () => {
    tenantService.validateTenant.mockResolvedValue({
      isValid: false,
      error: 'Tenant not found',
    });

    const req = { headers: { 'x-tenant-id': 'missing-tenant' } } as unknown as Request;

    await expect(
      middleware.use(req, {} as Response, next),
    ).rejects.toThrow(NotFoundException);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets tenant context and calls next for a valid tenant', async () => {
    const tenant = {
      id: 'tenant-1',
      name: 'Tenant One',
      code: 'TENANT_ONE',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    tenantService.validateTenant.mockResolvedValue({
      isValid: true,
      tenant,
    });

    const req = {
      headers: { 'x-tenant-id': 'tenant-1' },
    } as unknown as Request;

    await middleware.use(req, {} as Response, next);

    expect(tenantContext.getTenant()).toEqual(tenant);
    expect(tenantContext.getTenantId()).toBe('tenant-1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('supports array header values for x-tenant-id', async () => {
    const tenant = {
      id: 'tenant-2',
      name: 'Tenant Two',
      code: 'TENANT_TWO',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    tenantService.validateTenant.mockResolvedValue({
      isValid: true,
      tenant,
    });

    const req = {
      headers: { 'x-tenant-id': ['tenant-2'] },
    } as unknown as Request;

    await middleware.use(req, {} as Response, next);

    expect(tenantContext.getTenantId()).toBe('tenant-2');
    expect(next).toHaveBeenCalled();
  });
});
