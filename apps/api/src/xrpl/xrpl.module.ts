import { type DynamicModule, Global, Module, type Provider } from '@nestjs/common';
import type { XrplGateway } from '@tuitionflow/xrpl';
import type { AppConfig } from '../config/app-config';
import { APP_CONFIG, XRPL_GATEWAY } from '../tokens';
import { RecordingXrplGateway } from './recording-xrpl.gateway';

/**
 * Provides the XRPL gateway. With XRPL_ENABLED=true and a seed, it dynamically imports the real
 * XrplClient (Testnet); otherwise it uses the in-memory RecordingXrplGateway. The dynamic import
 * keeps the xrpl SDK out of the test runtime entirely.
 */
@Global()
@Module({})
export class XrplModule {
  static register(): DynamicModule {
    const provider: Provider = {
      provide: XRPL_GATEWAY,
      inject: [APP_CONFIG],
      useFactory: async (config: AppConfig): Promise<XrplGateway> => {
        if (config.xrplEnabled && config.xrplIssuerSeed) {
          const { XrplClient } = await import('@tuitionflow/xrpl');
          const client = new XrplClient({ wss: config.xrplWss, seed: config.xrplIssuerSeed });
          await client.connect();
          return client;
        }
        return new RecordingXrplGateway();
      },
    };
    return { module: XrplModule, providers: [provider], exports: [XRPL_GATEWAY] };
  }
}
