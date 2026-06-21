import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { HmacGuard } from '../common/hmac/hmac.guard';
import { CaseService } from '../cases/case.service';
import { PartnerWebhookDto } from './dto/partner-webhook.dto';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly service: CaseService) {}

  @Post('partner')
  @UseGuards(HmacGuard)
  @HttpCode(200)
  partner(@Body() dto: PartnerWebhookDto): Promise<{ status: string }> {
    return this.service.settle(dto.caseId, dto.paymentId, dto.status);
  }
}
