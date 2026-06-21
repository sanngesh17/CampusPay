import { Body, Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { CaseService } from './case.service';
import type { CaseDetailView, CaseView, ReceiptView } from './case.views';
import { CollectDocumentsDto } from './dto/collect-documents.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import type { InitiateResult } from './case.service';

@Controller('cases')
export class CaseController {
  constructor(private readonly service: CaseService) {}

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateCaseDto): Promise<CaseView> {
    return this.service.createCase(dto);
  }

  @Post(':id/documents')
  documents(@Param('id') id: string, @Body() dto: CollectDocumentsDto): Promise<CaseView> {
    return this.service.collectDocuments(id, dto.documents);
  }

  @Post(':id/validate')
  validate(@Param('id') id: string): Promise<CaseView> {
    return this.service.validate(id);
  }

  @Post(':id/quote')
  quote(@Param('id') id: string): Promise<CaseView> {
    return this.service.quote(id);
  }

  @Post(':id/initiate')
  initiate(
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<InitiateResult> {
    return this.service.initiate(id, idempotencyKey);
  }

  /** Demo-only: simulate partner settlement (the real path is the HMAC-verified webhook). */
  @Post(':id/settle')
  @HttpCode(200)
  settle(@Param('id') id: string): Promise<{ status: string }> {
    return this.service.demoSettle(id);
  }

  @Get(':id')
  getCase(@Param('id') id: string): Promise<CaseDetailView> {
    return this.service.getCase(id);
  }

  @Get(':id/receipt')
  receipt(@Param('id') id: string): Promise<ReceiptView> {
    return this.service.getReceipt(id);
  }
}
