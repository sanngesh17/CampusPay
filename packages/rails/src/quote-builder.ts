import { Money, Quote, QuoteId, type RailType } from '@tuitionflow/domain';
import type { RailConfig, TcsConfig } from './config';
import type { FundingType, QuoteRequest } from './types';

export interface QuoteConfig {
  readonly railConfig: RailConfig;
  readonly tcsConfig: TcsConfig;
  readonly quoteTtlMs?: number;
}

const DEFAULT_TTL_MS = 15 * 60 * 1000;

/** Loan-funded education maps to the 0%-TCS purpose; self-funded to the taxed purpose. */
export function purposeForFunding(funding: FundingType): string {
  return funding === 'LOAN' ? 'EDUCATION_LOAN' : 'EDUCATION_SELF';
}

export function computeFee(principal: Money, railId: RailType, cfg: RailConfig): Money {
  const fee = cfg.fees[railId];
  return Money.of(BigInt(fee.flatMinor), principal.currency).add(principal.multiplyByBps(fee.bps));
}

export function computeTcs(principal: Money, funding: FundingType, cfg: TcsConfig): Money {
  const rule = cfg.purposes[purposeForFunding(funding)];
  if (!rule || rule.ratePct === 0) return Money.zero(principal.currency);
  const threshold = Money.of(BigInt(cfg.thresholdMinor), principal.currency);
  const taxable = rule.appliesAboveThresholdOnly
    ? principal.gt(threshold)
      ? principal.subtract(threshold)
      : Money.zero(principal.currency)
    : principal;
  return taxable.applyRatio(BigInt(rule.ratePct), 100n);
}

/** Build a locked, internally-consistent Quote (principal + fees + TCS = finalPayable). */
export function buildQuote(
  req: QuoteRequest,
  railId: RailType,
  cfg: QuoteConfig,
  now: Date = new Date(),
): Quote {
  const principal = req.amount;
  const fees = computeFee(principal, railId, cfg.railConfig);
  const tcs = computeTcs(principal, req.funding, cfg.tcsConfig);
  const finalPayable = principal.add(fees).add(tcs);

  const rate = cfg.railConfig.fx[`${req.sourceCurrency}_${req.targetCurrency}`];
  const fxRate =
    rate !== undefined
      ? `1 ${req.sourceCurrency} = ${rate} ${req.targetCurrency}`
      : `${req.sourceCurrency} -> ${req.targetCurrency}`;

  return new Quote({
    id: QuoteId.generate(),
    fxRate,
    principal,
    fees,
    tcs,
    finalPayable,
    expiresAt: new Date(now.getTime() + (cfg.quoteTtlMs ?? DEFAULT_TTL_MS)),
  });
}
