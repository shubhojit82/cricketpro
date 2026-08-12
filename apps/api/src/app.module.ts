import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { TenantModule } from './tenant/tenant.module';
import { RbacModule } from './rbac/rbac.module';
import { TournamentModule } from './tournament/tournament.module';
import { TeamModule } from './team/team.module';
import { PlayerModule } from './player/player.module';
import { RosterModule } from './roster/roster.module';
import { VenueModule } from './venue/venue.module';
import { MatchModule } from './match/match.module';
import { MatchOfficialModule } from './match-official/match-official.module';
import { MatchLifecycleModule } from './match-lifecycle/match-lifecycle.module';
import { PlayingXiModule } from './playing-xi/playing-xi.module';
import { TossModule } from './toss/toss.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
    TenantModule,
    RbacModule,
    TournamentModule,
    TeamModule,
    PlayerModule,
    RosterModule,
    VenueModule,
    MatchModule,
    MatchOfficialModule,
    MatchLifecycleModule,
    PlayingXiModule,
    TossModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .exclude({
        path: 'health',
        method: RequestMethod.ALL,
      })
      .forRoutes('*');
  }
}
