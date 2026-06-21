import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JourneyService } from './journey.service';
import {
  LenderJourneyController,
  OperationsJourneyController,
  StudentJourneyController,
} from './journey.controller';
import { JourneyWebhookController } from './journey-webhook.controller';
import { PartnerWebhookGuard } from './partner-webhook.guard';

@Module({
  imports: [AuthModule],
  controllers: [
    StudentJourneyController,
    LenderJourneyController,
    OperationsJourneyController,
    JourneyWebhookController,
  ],
  providers: [JourneyService, PartnerWebhookGuard],
})
export class JourneyModule {}
