import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RbacModule } from '../rbac/rbac.module';
import { MatchLifecycleModule } from '../match-lifecycle/match-lifecycle.module';
import { MatchOfficialController } from './match-official.controller';
import { MatchOfficialService } from './match-official.service';

@Module({
  imports: [DatabaseModule, TenantModule, AuditLogModule, RbacModule, MatchLifecycleModule],
  controllers: [MatchOfficialController],
  providers: [MatchOfficialService],
  exports: [MatchOfficialService],
})
export class MatchOfficialModule {}
