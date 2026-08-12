import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MatchLifecycleService } from './match-lifecycle.service';

@Module({
  imports: [DatabaseModule],
  providers: [MatchLifecycleService],
  exports: [MatchLifecycleService],
})
export class MatchLifecycleModule {}
