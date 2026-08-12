import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RbacModule } from '../rbac/rbac.module';
import { MatchLifecycleModule } from '../match-lifecycle/match-lifecycle.module';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';

@Module({
  imports: [DatabaseModule, TenantModule, AuditLogModule, RbacModule, MatchLifecycleModule],
  controllers: [MatchController],
  providers: [MatchService],
  exports: [MatchService],
})
export class MatchModule {}
