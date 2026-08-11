import { AuditLogService } from './audit-log.service';
import { AuditLogValidationError } from './audit-log.types';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prismaService: any;

  beforeEach(() => {
    prismaService = {
      tenant: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new AuditLogService(prismaService);
  });

  it('writes a successful audit record', async () => {
    const written = {
      id: 'audit-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'MATCH_CREATED',
      entityType: 'Match',
      entityId: 'match-1',
      payload: { foo: 'bar' },
      correlationId: 'corr-1',
      createdAt: new Date(),
    };

    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
    });
    prismaService.auditLog.create.mockResolvedValue(written);

    const result = await service.record({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'MATCH_CREATED',
      entityType: 'Match',
      entityId: 'match-1',
      payload: { foo: 'bar' },
      correlationId: 'corr-1',
    });

    expect(result).toEqual(written);
    expect(prismaService.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'MATCH_CREATED',
        entityType: 'Match',
        entityId: 'match-1',
        correlationId: 'corr-1',
      }),
    });
  });

  it('rejects a user from a different tenant', async () => {
    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-2',
    });

    await expect(
      service.record({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'MATCH_UPDATED',
        entityType: 'Match',
      }),
    ).rejects.toThrow(AuditLogValidationError);
  });

  it('returns audit entries for a given entity', async () => {
    const entries = [{ id: 'audit-2' }, { id: 'audit-3' }];
    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.auditLog.findMany.mockResolvedValue(entries);

    const result = await service.getForEntity(
      'tenant-1',
      'Match',
      'match-1',
    );

    expect(result).toEqual(entries);
    expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        entityType: 'Match',
        entityId: 'match-1',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('returns audit entries for a correlationId', async () => {
    const entries = [{ id: 'audit-4' }, { id: 'audit-5' }];
    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.auditLog.findMany.mockResolvedValue(entries);

    const result = await service.getForCorrelationId('tenant-1', 'corr-1');

    expect(result).toEqual(entries);
    expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        correlationId: 'corr-1',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('ensures audit logs are append-only', async () => {
    prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
    });
    prismaService.auditLog.create.mockResolvedValue({ id: 'audit-6' });

    await service.record({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'ACTION_1',
      entityType: 'Match',
    });

    await service.record({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'ACTION_2',
      entityType: 'Match',
    });

    expect(prismaService.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it('returns null for a record that does not match the tenant', async () => {
    prismaService.auditLog.findFirst.mockResolvedValue(null);

    const result = await service.getById('audit-9', 'tenant-2');

    expect(result).toBeNull();
    expect(prismaService.auditLog.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'audit-9',
        tenantId: 'tenant-2',
      },
    });
  });
});
