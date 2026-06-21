import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './auth.decorators';
import type { AuthenticatedRequest, AuthUser, UserRole } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { headers: Record<string, string | undefined> }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Authentication required');
    try {
      request.user = await this.jwt.verifyAsync<AuthUser>(header.slice(7));
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(request.user.role))
      throw new ForbiddenException('Role is not permitted');
    return true;
  }
}
