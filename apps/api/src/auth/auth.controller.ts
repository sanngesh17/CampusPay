import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { CurrentUser } from './auth.decorators';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.types';
import type { Request, Response } from 'express';

class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login') async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { refreshToken, ...result } = await this.auth.login(body.email, body.password);
    this.setRefreshCookie(response, refreshToken);
    return result;
  }
  @Post('refresh') async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { refreshToken, ...result } = await this.auth.refresh(this.readRefreshCookie(request));
    this.setRefreshCookie(response, refreshToken);
    return result;
  }
  @Post('logout') logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): { loggedOut: true } {
    this.auth.logout(this.readRefreshCookie(request, false));
    response.clearCookie('tf_refresh', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth',
    });
    return { loggedOut: true };
  }
  @Get('me') @UseGuards(AuthGuard) me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  private setRefreshCookie(response: Response, token: string): void {
    response.cookie('tf_refresh', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth',
      maxAge: 8 * 60 * 60_000,
    });
  }
  private readRefreshCookie(request: Request, required = true): string {
    const token = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('tf_refresh='))
      ?.slice('tf_refresh='.length);
    if (!token && required) throw new UnauthorizedException('Refresh cookie is required');
    return token ?? '';
  }
}
