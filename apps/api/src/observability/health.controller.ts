import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { PrivateStorage } from '../common/storage/private-storage';
import type { AppConfig } from '../config/app-config';
import { APP_CONFIG, PRISMA_CLIENT, PRIVATE_STORAGE } from '../tokens';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PRISMA_CLIENT) private readonly db: import('@prisma/client').PrismaClient | null,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
  ) {}
  @Get()
  check(): { status: string; uptimeSeconds: number; timestamp: string } {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{
    status: string;
    simulation: true;
    persistence: string;
    storage: string;
  }> {
    try {
      if (this.config.persistence === 'prisma') {
        if (!this.db) throw new Error('Prisma client is unavailable');
        await this.db.$queryRaw`SELECT 1`;
      }
      await this.storage.health();
      return {
        status: 'ready',
        simulation: true,
        persistence: this.config.persistence,
        storage: this.config.storage,
      };
    } catch {
      throw new ServiceUnavailableException('Persistence or private storage is unavailable');
    }
  }
}
