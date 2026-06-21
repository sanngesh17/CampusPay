import { DomainError } from '@tuitionflow/domain';

export class NotImplementedError extends DomainError {
  constructor(rail: string) {
    super(`${rail} rail adapter is not implemented yet`, 'RAIL_NOT_IMPLEMENTED');
  }
}

export class RailError extends DomainError {
  constructor(message: string, code = 'RAIL_ERROR') {
    super(message, code);
  }
}
