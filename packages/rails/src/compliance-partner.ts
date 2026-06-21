export type ComplianceOutcome = 'APPROVED' | 'REJECTED' | 'INFORMATION_REQUIRED';
export type RegulatoryRoute = 'PA_CB' | 'AD_BANK';

export interface ComplianceRequest {
  readonly caseId: string;
  readonly studentAge: number;
  readonly sourceAmountMinor: string;
  readonly destinationCountry: string;
  readonly destinationCurrency: string;
  readonly hasPan: boolean;
  readonly declarationsAccepted: boolean;
}

export interface ComplianceDecision {
  readonly outcome: ComplianceOutcome;
  readonly route?: RegulatoryRoute;
  readonly purposeCode?: string;
  readonly taxMinor?: string;
  readonly approvalReference?: string;
  readonly reasonCode?: string;
  readonly decidedAt: string;
  readonly provider: string;
}

export interface CompliancePartnerAdapter {
  assess(request: ComplianceRequest): Promise<ComplianceDecision>;
}

/** Synthetic only. A real adapter must return the regulated partner's authoritative decision. */
export class SimulatedCompliancePartner implements CompliancePartnerAdapter {
  async assess(request: ComplianceRequest): Promise<ComplianceDecision> {
    const decidedAt = new Date().toISOString();
    if (request.studentAge < 18)
      return {
        outcome: 'REJECTED',
        reasonCode: 'MINOR_NOT_SUPPORTED',
        decidedAt,
        provider: 'SIMULATED_PA_CB',
      };
    if (!request.hasPan || !request.declarationsAccepted)
      return {
        outcome: 'INFORMATION_REQUIRED',
        reasonCode: 'REQUIRED_EVIDENCE_MISSING',
        decidedAt,
        provider: 'SIMULATED_PA_CB',
      };
    const route: RegulatoryRoute =
      BigInt(request.sourceAmountMinor) <= 2_500_000_000n ? 'PA_CB' : 'AD_BANK';
    return {
      outcome: 'APPROVED',
      route,
      purposeCode: 'S0305',
      taxMinor: '0',
      approvalReference: `SIM-COMP-${request.caseId.slice(0, 8).toUpperCase()}`,
      decidedAt,
      provider: 'SIMULATED_PA_CB',
    };
  }
}
