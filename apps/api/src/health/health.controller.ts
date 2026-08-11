import { Controller, Get } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(private readonly redisService: RedisService) {}

  @Get()
  async check() {
    let redisStatus = 'down';
    let redisPing: string | null = null;

    try {
      redisPing = await this.redisService.ping();
      redisStatus = redisPing === 'PONG' ? 'up' : 'down';
    } catch {
      redisStatus = 'down';
    }

    return {
      status: redisStatus === 'up' ? 'ok' : 'degraded',
      service: 'cricketpro-api',
      timestamp: new Date().toISOString(),
      redis: {
        status: redisStatus,
        ping: redisPing,
      },
    };
  }
}
