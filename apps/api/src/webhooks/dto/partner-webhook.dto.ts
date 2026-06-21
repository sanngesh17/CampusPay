import { IsString } from 'class-validator';

export class PartnerWebhookDto {
  @IsString()
  caseId: string;

  @IsString()
  paymentId: string;

  @IsString()
  status: string;
}
