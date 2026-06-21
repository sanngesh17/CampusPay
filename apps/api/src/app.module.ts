import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { CaseModule } from './cases/case.module';
import { CoreModule } from './core.module';
import { DataSeeder } from './data-seeder';
import { ObservabilityModule } from './observability/observability.module';
import { PersistenceModule } from './persistence/persistence.module';
import { RailsModule } from './rails/rails.module';
import { XrplModule } from './xrpl/xrpl.module';
import { AuthModule } from './auth/auth.module';
import { JourneyModule } from './journey/journey.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'web', 'dist'),
      exclude: ['/api/(.*)', '/health/(.*)'],
    }),
    CoreModule,
    PersistenceModule.register(),
    XrplModule.register(),
    RailsModule.register(),
    ObservabilityModule,
    CaseModule,
    AuthModule,
    JourneyModule,
  ],
  providers: [DataSeeder],
})
export class AppModule {}
