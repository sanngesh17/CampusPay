import { Global, Module } from '@nestjs/common';
import { FieldCipher } from './common/crypto/field-cipher';
import { loadAppConfig, type AppConfig } from './config/app-config';
import { createPrivateStorage, type PrivateStorage } from './common/storage/private-storage';
import { APP_CONFIG, FIELD_CIPHER, PRIVATE_STORAGE } from './tokens';

/** Global providers: parsed app config and the field-level cipher. */
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: (): AppConfig => loadAppConfig() },
    {
      provide: FIELD_CIPHER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): FieldCipher => new FieldCipher(config.encryptionKey),
    },
    {
      provide: PRIVATE_STORAGE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): PrivateStorage => createPrivateStorage(config),
    },
  ],
  exports: [APP_CONFIG, FIELD_CIPHER, PRIVATE_STORAGE],
})
export class CoreModule {}
