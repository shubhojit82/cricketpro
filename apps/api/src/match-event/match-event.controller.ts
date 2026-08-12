import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { Roles } from '../rbac/roles.decorator';
import { Scope } from '../rbac/scope.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { AppendMatchEventDto } from './dto/append-match-event.dto';
import { MatchEventService } from './match-event.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { MatchService } from '../match/match.service';
import { MatchLifecycleService } from '../match-lifecycle/match-lifecycle.service';
import { AuditLogService } from '../audit-log/audit-log.service';

const writeRoles: RoleName[] = [
  RoleName.SUPER_ADMIN,
  RoleName.TENANT_ADMIN,
  RoleName.TOURNAMENT_ADMIN,
  RoleName.MATCH_REFEREE,
  RoleName.SCORER,
  RoleName.BACKUP_SCORER,
];

const readRoles: RoleName[] = [
  RoleName.SUPER_ADMIN,
  RoleName.TENANT_ADMIN,
  RoleName.TOURNAMENT_ADMIN,
  RoleName.MATCH_REFEREE,
  RoleName.SCORER,
  RoleName.BACKUP_SCORER,
  RoleName.UMPIRE,
  RoleName.STATISTICIAN,
  RoleName.TEAM_MANAGER,
  RoleName.MEDIA_MANAGER,
  RoleName.BROADCAST_USER,
];

@Controller('matches/:matchId/events')
@UseGuards(RbacGuard)
export class MatchEventController {
  constructor(
    private readonly matchEventService: MatchEventService,
    private readonly tenantContext: TenantContextService,
    private readonly matchService: MatchService,
    private readonly lifecycle: MatchLifecycleService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Post()
  @Roles(...writeRoles)
  @Scope('match')
  async append(
    @Param('matchId') matchId: string,
    @Body() dto: AppendMatchEventDto,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new NotFoundException();
    }

    const match = await this.matchService.findById(matchId);
    if (!match || match.tenantId !== tenantId) {
      throw new NotFoundException();
    }

    if (this.lifecycle.isTerminal(match.status)) {
      throw new ConflictException('Match is in a terminal state');
    }

    // Idempotency: if clientEventId already exists, return existing event and avoid duplicate audit
    const existing = await this.matchEventService.getByClientEventId(
      tenantId,
      dto.clientEventId,
    );

    if (existing) {
      return existing;
    }

    const input = {
      tenantId,
      tournamentId: match.tournamentId,
      matchId,
      eventType: dto.eventType,
      inningsNumber: dto.inningsNumber,
      overNumber: dto.overNumber,
      ballNumber: dto.ballNumber,
      sequenceNumber: dto.sequenceNumber,
      payload: dto.payload,
      createdBy: dto.createdBy,
      deviceId: dto.deviceId,
      clientEventId: dto.clientEventId,
      supersedesEventId: dto.supersedesEventId,
      correlationId: dto.correlationId,
    };

    try {
      const created = await this.matchEventService.appendEvent(input as any);

      // Audit on successful new append
      await this.auditLog.record({
        tenantId,
        userId: input.createdBy ?? undefined,
        action: 'MATCH_EVENT_APPENDED',
        entityType: 'MatchEvent',
        entityId: created.id,
        payload: {
          matchId,
          eventType: created.eventType,
          clientEventId: created.clientEventId,
          correlationId: created.correlationId ?? null,
        },
      }).catch(() => {});

      return { statusCode: HttpStatus.CREATED, ...created };
    } catch (err) {
      // Map domain conflict
      // MatchEventConflictError is thrown by service on sequence collisions
      throw err;
    }
  }

  @Get()
  @Roles(...readRoles)
  @Scope('match')
  findAll(@Param('matchId') matchId: string) {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new NotFoundException();
    }

    return this.matchEventService.getEventsForMatch(matchId, tenantId);
  }

  @Get(':eventId')
  @Roles(...readRoles)
  @Scope('match')
  async findOne(@Param('matchId') matchId: string, @Param('eventId') eventId: string) {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new NotFoundException();
    }
    const ev = await this.matchEventService.getEventById(eventId);

    if (!ev || ev.matchId !== matchId || ev.tenantId !== tenantId) {
      throw new NotFoundException();
    }

    return ev;
  }
}
