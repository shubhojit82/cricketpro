import { TenantService } from './tenant.service';

describe('TenantService', () => {
  let tenantService: TenantService;
  let prismaService: { tenant: { findUnique: jest.Mock } };

  beforeEach(() => {
    prismaService = {
      tenant: {
        findUnique: jest.fn(),
      },
    };

    tenantService = new TenantService(prismaService as any);
  });

  it('returns valid result when tenant exists', async () => {
    const tenant = {
      id: 'tenant-1',
      name: 'Tenant One',
      code: 'TENANT_ONE',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    (prismaService.tenant.findUnique as jest.Mock).mockResolvedValue(tenant);

    const result = await tenantService.validateTenant('tenant-1');

    expect(result).toEqual({
      isValid: true,
      tenant,
    });
    expect(prismaService.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
    });
  });

  it('returns invalid result when tenant does not exist', async () => {
    (prismaService.tenant.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await tenantService.validateTenant('missing-tenant');

    expect(result).toEqual({
      isValid: false,
      error: 'Tenant with ID missing-tenant not found',
    });
  });
});
