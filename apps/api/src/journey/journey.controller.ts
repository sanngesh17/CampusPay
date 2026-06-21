import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsIn,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { JourneyService } from './journey.service';

class CreateJourneyDto {
  @IsIn(['FULL_LOAN', 'PARTIAL_LOAN', 'SELF_FUNDED']) fundingType:
    | 'FULL_LOAN'
    | 'PARTIAL_LOAN'
    | 'SELF_FUNDED';
  @IsNumberString() amountMinor: string;
  @IsOptional() @IsNumberString() lenderAmountMinor?: string;
  @IsOptional() @IsString() lenderId?: string;
  @IsOptional() @IsString() lenderName?: string;
  @IsOptional() @IsString() branchName?: string;
  @IsOptional() @IsString() loanAccountNumber?: string;
  @IsOptional() @IsString() sanctionReference?: string;
  @IsString() universityName: string;
  @IsString() destinationCountry: string;
  @IsIn(['GBP', 'USD']) targetCurrency: 'GBP' | 'USD';
  @IsNumberString() targetAmountMinor: string;
  @IsObject() feeBreakdown: {
    tuitionAdvanceMinor: string;
    courseDepositMinor: string;
    accommodationMinor: string;
    otherMinor: string;
  };
  @IsString() providerName: string;
  @IsIn(['BANK', 'NBFC']) providerType: 'BANK' | 'NBFC';
  @IsEmail() studentEmail: string;
  @IsString() firstName: string;
  @IsOptional() @IsString() middleName?: string;
  @IsString() familyName: string;
  @IsString() pinCode: string;
  @IsString() addressLine1: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsString() city: string;
  @IsOptional() @IsString() state?: string;
  @IsString() phone: string;
  @IsString() payerName: string;
  @IsString() payerRelationship: string;
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/) payerPan: string;
}
class LenderDecisionDto {
  @IsIn(['APPROVE', 'REJECT', 'CHANGES']) decision: 'APPROVE' | 'REJECT' | 'CHANGES';
  @IsOptional() @IsString() reason?: string;
}
class FundingDto {
  @IsIn(['LENDER', 'STUDENT']) kind: 'LENDER' | 'STUDENT';
  @IsString() @MinLength(4) transferReference: string;
}
class GrievanceDto {
  @IsString() category: string;
  @IsString() @MinLength(10) message: string;
}
class PrivacyRequestDto {
  @IsIn(['ACCESS', 'CORRECTION', 'ERASURE', 'CONSENT_WITHDRAWAL']) type:
    | 'ACCESS'
    | 'CORRECTION'
    | 'ERASURE'
    | 'CONSENT_WITHDRAWAL';
  @IsString() @MinLength(10) details: string;
}
class PrivacyResolutionDto {
  @IsIn(['COMPLETED', 'DECLINED']) decision: 'COMPLETED' | 'DECLINED';
  @IsString() @MinLength(10) outcome: string;
}
class LegalHoldDto {
  @IsBoolean() active: boolean;
  @IsString() @MinLength(5) reason: string;
}
class RetentionDto {
  @IsISO8601() cutoffBefore: string;
}

@Controller('api/cases')
@UseGuards(AuthGuard)
export class StudentJourneyController {
  constructor(private readonly journey: JourneyService) {}
  @Post() @Roles('STUDENT') create(@CurrentUser() user: AuthUser, @Body() body: CreateJourneyDto) {
    return this.journey.create(user, body);
  }
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.journey.list(user);
  }
  @Get(':id') get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.journey.get(id, user);
  }
  @Post(':id/documents')
  @Roles('STUDENT')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: { originalname: string; mimetype: string; buffer: Buffer },
  ) {
    if (!file) throw new Error('Evidence file is required');
    return this.journey.addDocument(id, user, file);
  }
  @Get(':id/documents/:documentId') async document(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const file = await this.journey.getDocument(id, documentId, user);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    response.send(file.buffer);
  }
  @Post(':id/submit') @Roles('STUDENT') submit(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.journey.submit(id, user);
  }
  @Post(':id/grievances') @Roles('STUDENT') grievance(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: GrievanceDto,
  ) {
    return this.journey.createGrievance(id, user, body.category, body.message);
  }
  @Post(':id/privacy-requests') @Roles('STUDENT') privacyRequest(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: PrivacyRequestDto,
  ) {
    return this.journey.createPrivacyRequest(id, user, body.type, body.details);
  }
  @Get(':id/privacy-export') @Roles('STUDENT') async privacyExport(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const exportData = await this.journey.exportPersonalData(id, user);
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Content-Disposition', `attachment; filename="tuitionflow-data-${id}.json"`);
    response.send(JSON.stringify(exportData, null, 2));
  }
  @Get(':id/instruction') async instruction(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const pdf = await this.journey.instruction(id, user);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="tuitionflow-${id}.pdf"`);
    response.send(pdf);
  }
  @Get(':id/receipt') async receipt(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const pdf = await this.journey.receipt(id, user);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="tuitionflow-receipt-${id}.pdf"`,
    );
    response.send(pdf);
  }
}

@Controller('api/lender/cases')
@UseGuards(AuthGuard)
@Roles('LENDER_OFFICER')
export class LenderJourneyController {
  constructor(private readonly journey: JourneyService) {}
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.journey.list(user);
  }
  @Post(':id/decision') decide(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: LenderDecisionDto,
  ) {
    return this.journey.lenderDecision(id, user, body.decision, body.reason);
  }
  @Post(':id/funding') fund(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: FundingDto,
  ) {
    return this.journey.recordFunding(id, user, 'LENDER', body.transferReference);
  }
}

@Controller('api/operations/cases')
@UseGuards(AuthGuard)
@Roles('PAYMENT_OPS')
export class OperationsJourneyController {
  constructor(private readonly journey: JourneyService) {}
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.journey.list(user);
  }
  @Post(':id/funding') fund(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: FundingDto,
  ) {
    return this.journey.recordFunding(id, user, body.kind, body.transferReference);
  }
  @Post(':id/quote') quote(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.journey.quote(id, user);
  }
  @Post(':id/payout') payout(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.journey.initiatePayout(id, user, key ?? randomKey(id));
  }
  @Post(':id/payout/advance') advance(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.journey.advancePayout(id, user);
  }
  @Post(':id/payout/fail') fail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.journey.failPayout(id, user);
  }
  @Post(':id/reconcile') reconcile(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.journey.reconcile(id, user);
  }
  @Post(':id/grievances/:grievanceId/resolve') resolveGrievance(
    @Param('id') id: string,
    @Param('grievanceId') grievanceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.journey.resolveGrievance(id, grievanceId, user);
  }
  @Post(':id/privacy-requests/:requestId/resolve') resolvePrivacyRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: PrivacyResolutionDto,
  ) {
    return this.journey.resolvePrivacyRequest(id, requestId, user, body.decision, body.outcome);
  }
  @Post(':id/legal-hold') legalHold(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: LegalHoldDto,
  ) {
    return this.journey.setLegalHold(id, user, body.active, body.reason);
  }
  @Post('retention/run') retention(@CurrentUser() user: AuthUser, @Body() body: RetentionDto) {
    return this.journey.runRetention(user, body.cutoffBefore);
  }
}

function randomKey(id: string): string {
  return `demo-${id}`;
}
