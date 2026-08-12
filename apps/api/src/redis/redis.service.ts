import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createClient,
  RedisClientType,
} from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: RedisClientType;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      throw new Error('REDIS_URL is not defined');
    }

    this.client = createClient({
      url: redisUrl,
    });

    this.client.on('connect', () => {
      console.log('Redis connecting...');
    });

    this.client.on('ready', () => {
      console.log('Redis connected and ready');
    });

    this.client.on('error', (error: Error) => {
      console.error('Redis error:', error.message);
    });

    // Ensure Redis client is closed if the process is exiting (helps Jest worker cleanup)
    process.once('beforeExit', () => {
      if (this.client.isOpen) {
        // best-effort, ignore errors
        this.client.quit().catch(() => {});
      }
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}
