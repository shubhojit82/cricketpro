import { ConflictException, NotFoundException } from '@nestjs/common';
import { MatchOfficialRole, MatchStatus } from '@prisma/client';
import { MatchOfficialService } from './match-official.service';

describe('MatchOfficialService', () => {
  let service: MatchOfficialService;
  let prismaService: any;
  let tenantContext: any;
  let auditLogService: any;
  let lifecycle: any;

  beforeEach(() => {
    prismaService = {
      match: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'match-1',
          tenantId: 'tenant-1',
          status: MatchStatus.SCHEDULED,
        }),
      },
      matchOfficial: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'official-1',
          matchId: 'match-1',
          tenantId: 'tenant-1',
          role: MatchOfficialRole.UMPIRE,
          name: 'A. Smith',
          userId: null,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'official-1',
          matchId: 'match-1',
          tenantId: 'tenant-1',
          role: MatchOfficialRole.UMPIRE,
          name: 'B. Smith',
          userId: null,
        }),
        delete: jest.fn().mockResolvedValue({
          id: 'official-1',
          matchId: 'match-1',
          tenantId: 'tenant-1',
          role: MatchOfficialRole.UMPIRE,
          name: 'A. Smith',
          userId: null,
        }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1', tenantId: 'tenant-1' }),
      },
    };

    tenantContext = { getTenantId: jest.fn().mockReturnValue('tenant-1') };
    auditLogService = { record: jest.fn().mockResolvedValue({}) };
    lifecycle = {
      assertCanEditOfficials: jest.fn(),
    };

    service = new MatchOfficialService(
      prismaService,
      tenantContext,
      auditLogService,
      lifecycle as any,
    );
  });

  it('creates an official and records an audit log', async () => {
    const result = await service.create('match-1', {
      role: MatchOfficialRole.UMPIRE,
      name: 'A. Smith',
    });

    expect(result.id).toBe('official-1');
    expect(prismaService.matchOfficial.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        matchId: 'match-1',
        userId: null,
        name: 'A. Smith',
        role: MatchOfficialRole.UMPIRE,
      },
    });
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MATCH_OFFICIAL_ADDED',
        entityType: 'MatchOfficial',
      }),
    );
  });

  it('rejects edits after live status using lifecycle policy', async () => {
    prismaService.match.findFirst.mockResolvedValue({
      id: 'match-1',
      tenantId: 'tenant-1',
      status: MatchStatus.LIVE,
    });
    lifecycle.assertCanEditOfficials.mockImplementation(() => {
      throw new ConflictException('Match officials cannot be changed once the match is live or completed');
    });

    await expect(
      service.create('match-1', {
        role: MatchOfficialRole.UMPIRE,
        name: 'A. Smith',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects unknown officials in tenant', async () => {
    prismaService.user.findFirst.mockResolvedValue(null);

    await expect(
      service.create('match-1', {
        role: MatchOfficialRole.UMPIRE,
        name: 'A. Smith',
        userId: 'user-9',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
