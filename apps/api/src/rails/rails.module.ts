import { existsSync } from 'node:fs';
import { type DynamicModule, Global, Module, type Provider } from '@nestjs/common';
import {
  createRailRouter,
  loadRailConfig,
  loadTcsConfig,
  type RailConfig,
  type RailRouter,
  type TcsConfig,
} from '@tuitionflow/rails';
import type { AppConfig } from '../config/app-config';
import { APP_CONFIG, RAIL_ROUTER } from '../tokens';

const DEFAULT_RAIL_CONFIG: RailConfig = {
  capInrMinor: 2_500_000_000,
  fees: {
    A: { flatMinor: 50_000, bps: 25 },
    B: { flatMinor: 150_000, bps: 35 },
    C: { flatMinor: 0, bps: 20 },
  },
  fx: { INR_GBP: 0.0095, INR_USD: 0.012 },
  corridors: { A: ['GBP', 'USD'], B: ['GBP', 'USD'], C: ['USD'] },
  featureFlags: { rippleRail: false },
};

const DEFAULT_TCS_CONFIG: TcsConfig = {
  thresholdMinor: 70_000_000,
  purposes: {
    EDUCATION_LOAN: { ratePct: 0, appliesAboveThresholdOnly: true },
    EDUCATION_SELF: { ratePct: 5, appliesAboveThresholdOnly: true },
    OTHER: { ratePct: 20, appliesAboveThresholdOnly: true },
  },
};

@Global()
@Module({})
export class RailsModule {
  static register(): DynamicModule {
    const provider: Provider = {
      provide: RAIL_ROUTER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): RailRouter => {
        const railConfig =
          config.railConfigPath && existsSync(config.railConfigPath)
            ? loadRailConfig(config.railConfigPath)
            : DEFAULT_RAIL_CONFIG;
        const tcsConfig =
          config.tcsConfigPath && existsSync(config.tcsConfigPath)
            ? loadTcsConfig(config.tcsConfigPath)
            : DEFAULT_TCS_CONFIG;
        return createRailRouter(railConfig, tcsConfig);
      },
    };
    return { module: RailsModule, providers: [provider], exports: [RAIL_ROUTER] };
  }
}
