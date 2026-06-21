import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import type { XrplGateway } from '@tuitionflow/xrpl';
import { CaseService } from '../cases/case.service';
import type { CaseSummary } from '../cases/case.views';
import { AttestationService } from '../events/attestation.service';
import type { AttestationRecord } from '../persistence/records';
import { XRPL_GATEWAY } from '../tokens';
import { IssueCredentialDto } from './dto/issue-credential.dto';

@Controller('admin')
export class AdminController {
  constructor(
    @Inject(XRPL_GATEWAY) private readonly gateway: XrplGateway,
    private readonly attestations: AttestationService,
    private readonly cases: CaseService,
  ) {}

  @Get('cases')
  listCases(): Promise<CaseSummary[]> {
    return this.cases.listCases();
  }

  @Post('credentials')
  async issueCredential(
    @Body() dto: IssueCredentialDto,
  ): Promise<{ txHash: string; validated: boolean }> {
    const tx = await this.gateway.issueCredential({
      subject: dto.subject,
      credentialType: dto.credentialType,
    });
    return { txHash: tx.hash, validated: tx.validated };
  }

  @Get('attestations/:caseId')
  attestations_(@Param('caseId') caseId: string): Promise<AttestationRecord[]> {
    return this.attestations.list(caseId);
  }
}
