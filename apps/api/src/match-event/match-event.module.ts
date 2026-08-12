import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TenantModule } from '../tenant/tenant.module';
import { MatchEventService } from './match-event.service';
import { MatchEventController } from './match-event.controller';
import { MatchModule } from '../match/match.module';
import { MatchLifecycleModule } from '../match-lifecycle/match-lifecycle.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [DatabaseModule, TenantModule, MatchModule, MatchLifecycleModule, AuditLogModule],
  controllers: [MatchEventController],
  providers: [MatchEventService],
  exports: [MatchEventService],
})
export class MatchEventModule {}
