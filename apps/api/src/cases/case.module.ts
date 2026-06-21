import { Module } from '@nestjs/common';
import { AdminController } from '../admin/admin.controller';
import { HmacGuard } from '../common/hmac/hmac.guard';
import { AttestationService } from '../events/attestation.service';
import { WebhookController } from '../webhooks/webhook.controller';
import { CaseController } from './case.controller';
import { CaseService } from './case.service';

@Module({
  controllers: [CaseController, WebhookController, AdminController],
  providers: [CaseService, AttestationService, HmacGuard],
})
export class CaseModule {}
