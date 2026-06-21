import { IllegalTransition } from '../errors/DomainError';
import { CaseStateMachine } from './CaseStateMachine';
import { CaseStatus } from './CaseStatus';
import { isTerminal, TRANSITIONS } from './transitions';

const ALL = Object.values(CaseStatus);

describe('CaseStateMachine (full transition matrix)', () => {
  const sm = new CaseStateMachine();

  it('defines a transition entry for every status', () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...ALL].sort());
  });

  it('allows every declared (legal) transition', () => {
    for (const from of ALL) {
      for (const to of TRANSITIONS[from]) {
        expect(sm.canTransition(from, to)).toBe(true);
        expect(() => sm.assertCanTransition(from, to)).not.toThrow();
      }
    }
  });

  it('throws IllegalTransition for every non-declared (illegal) transition', () => {
    for (const from of ALL) {
      const legal = new Set(TRANSITIONS[from]);
      for (const to of ALL) {
        if (legal.has(to)) continue;
        expect(sm.canTransition(from, to)).toBe(false);
        expect(() => sm.assertCanTransition(from, to)).toThrow(IllegalTransition);
      }
    }
  });

  it('marks only RECONCILED and REFUND_INITIATED as terminal', () => {
    expect(isTerminal(CaseStatus.RECONCILED)).toBe(true);
    expect(isTerminal(CaseStatus.REFUND_INITIATED)).toBe(true);
    expect(isTerminal(CaseStatus.PAID)).toBe(false);
    expect(isTerminal(CaseStatus.DRAFT)).toBe(false);
  });

  it('IllegalTransition carries from/to for audit', () => {
    expect.assertions(3);
    try {
      sm.assertCanTransition(CaseStatus.PAID, CaseStatus.DRAFT);
    } catch (err) {
      expect(err).toBeInstanceOf(IllegalTransition);
      expect((err as IllegalTransition).from).toBe(CaseStatus.PAID);
      expect((err as IllegalTransition).to).toBe(CaseStatus.DRAFT);
    }
  });
});
