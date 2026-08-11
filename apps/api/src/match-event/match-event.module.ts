import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TenantModule } from '../tenant/tenant.module';
import { MatchEventService } from './match-event.service';

@Module({
  imports: [DatabaseModule, TenantModule],
  providers: [MatchEventService],
  exports: [MatchEventService],
})
export class MatchEventModule {}
