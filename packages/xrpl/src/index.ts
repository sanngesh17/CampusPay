// @tuitionflow/xrpl — reusable XRPL gateway. No xrpl.js types are re-exported here:
// the package boundary stays SDK-agnostic.

export * from './errors';
export * from './guards';
export * from './types';
export * from './XrplGateway';
export { XrplClient } from './XrplClient';
export {
  ATTESTATION_MEMO_TYPE,
  buildAttestationPayload,
  type AttestationMemoPayload,
} from './attestation-memo';
