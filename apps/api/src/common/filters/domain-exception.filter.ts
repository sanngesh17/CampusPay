import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  DomainError,
  IllegalTransition,
  NoEligibleRailError,
  QuoteExpiredError,
} from '@tuitionflow/domain';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

/** Maps domain/HTTP errors to clean JSON responses at the edge. Never leaks stack traces. */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host
      .switchToHttp()
      .getResponse<{ status(c: number): { json(b: ErrorBody): void } }>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(`${body.code}: ${body.message}`);
    }
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return { statusCode: status, code: this.httpCode(status), message: exception.message };
    }
    if (exception instanceof DomainError) {
      return {
        statusCode: this.domainStatus(exception),
        code: exception.code,
        message: exception.message,
      };
    }
    // XRPL/other typed errors expose a string `code` but aren't DomainError instances.
    if (exception instanceof Error) {
      const maybeCode = (exception as { code?: unknown }).code;
      if (typeof maybeCode === 'string') {
        return { statusCode: HttpStatus.BAD_REQUEST, code: maybeCode, message: exception.message };
      }
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    };
  }

  private domainStatus(error: DomainError): number {
    if (error instanceof IllegalTransition || error instanceof QuoteExpiredError) {
      return HttpStatus.CONFLICT;
    }
    if (error instanceof NoEligibleRailError) {
      return HttpStatus.UNPROCESSABLE_ENTITY;
    }
    return HttpStatus.BAD_REQUEST;
  }

  private httpCode(status: number): string {
    return HttpStatus[status] ?? 'HTTP_ERROR';
  }
}
