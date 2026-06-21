import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser, UserRole } from './auth.types';

export const ROLES_KEY = 'tuitionflow.roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  },
);
