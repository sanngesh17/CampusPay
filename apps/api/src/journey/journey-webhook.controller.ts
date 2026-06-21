import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { JourneyService } from './journey.service';
import { PartnerWebhookGuard } from './partner-webhook.guard';

class PaymentsDirectWebhookDto {
  @IsString() caseId: string;
  @IsString() eventId: string;
  @IsIn(['VALIDATING', 'TRANSFERRING', 'COMPLETED', 'FAILED']) status:
    | 'VALIDATING'
    | 'TRANSFERRING'
    | 'COMPLETED'
    | 'FAILED';
}

@Controller('api/webhooks')
export class JourneyWebhookController {
  constructor(private readonly journey: JourneyService) {}
  @Post('payments-direct')
  @UseGuards(PartnerWebhookGuard)
  @HttpCode(200)
  paymentsDirect(@Body() body: PaymentsDirectWebhookDto) {
    return this.journey.applyPaymentWebhook(body.caseId, body.eventId, body.status);
  }
}
