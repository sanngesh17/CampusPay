import { IsIn, IsNumberString, IsOptional, IsString } from 'class-validator';
import type { Currency, PaymentMode } from '@tuitionflow/domain';
import type { FundingType } from '@tuitionflow/rails';

export class CreateCaseDto {
  @IsString()
  studentId: string;

  @IsString()
  lenderId: string;

  @IsString()
  beneficiaryId: string;

  @IsNumberString()
  amountMinor: string;

  @IsIn(['INR', 'GBP', 'USD'])
  currency: Currency;

  @IsIn(['INTEGRATED', 'DIRECT'])
  mode: PaymentMode;

  @IsIn(['LOAN', 'SELF'])
  funding: FundingType;

  @IsOptional()
  @IsString()
  reference?: string;
}
