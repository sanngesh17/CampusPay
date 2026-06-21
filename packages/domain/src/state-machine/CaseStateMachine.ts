import { IllegalTransition } from '../errors/DomainError';
import { CaseStatus } from './CaseStatus';
import { TRANSITIONS } from './transitions';

/**
 * Explicit, guarded state machine. Auditable and unit-testable in isolation from the entity.
 */
export class CaseStateMachine {
  canTransition(from: CaseStatus, to: CaseStatus): boolean {
    return TRANSITIONS[from].includes(to);
  }

  assertCanTransition(from: CaseStatus, to: CaseStatus): void {
    if (!this.canTransition(from, to)) {
      throw new IllegalTransition(from, to);
    }
  }
}
