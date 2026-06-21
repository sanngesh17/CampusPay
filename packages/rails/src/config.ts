import { readFileSync } from 'node:fs';
import type { RailType } from '@tuitionflow/domain';

export interface RailFee {
  readonly flatMinor: number;
  readonly bps: number;
}

export interface RailConfig {
  readonly capInrMinor: number;
  readonly fees: Record<RailType, RailFee>;
  readonly fx: Record<string, number>;
  readonly corridors: Record<RailType, string[]>;
  readonly featureFlags: { readonly rippleRail: boolean };
}

export interface TcsPurposeRule {
  readonly ratePct: number;
  readonly appliesAboveThresholdOnly: boolean;
}

export interface TcsConfig {
  readonly thresholdMinor: number;
  readonly purposes: Record<string, TcsPurposeRule>;
}

export function loadRailConfig(path: string): RailConfig {
  return parseJson<RailConfig>(path);
}

export function loadTcsConfig(path: string): TcsConfig {
  return parseJson<TcsConfig>(path);
}

function parseJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}
