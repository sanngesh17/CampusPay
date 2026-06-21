import { createHash, randomBytes } from 'node:crypto';
import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { AuthUser } from './auth.types';

interface StoredUser extends AuthUser {
  readonly passwordHash: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly users = new Map<string, StoredUser>();
  private readonly refreshSessions = new Map<string, { userId: string; expiresAt: number }>();

  constructor(private readonly jwt: JwtService) {}

  async onModuleInit(): Promise<void> {
    const passwordHash = await argon2.hash('DemoPass123!', { type: argon2.argon2id });
    const seeded: StoredUser[] = [
      {
        id: 'student-a',
        email: 'student@tuitionflow.local',
        displayName: 'Aarav Sharma',
        role: 'STUDENT',
        passwordHash,
      },
      {
        id: 'lender-sbi-officer',
        email: 'lender@tuitionflow.local',
        displayName: 'SBI Disbursement Officer',
        role: 'LENDER_OFFICER',
        lenderId: 'lender-sbi',
        passwordHash,
      },
      {
        id: 'ops-1',
        email: 'ops@tuitionflow.local',
        displayName: 'TuitionFlow Payment Operations',
        role: 'PAYMENT_OPS',
        passwordHash,
      },
    ];
    for (const user of seeded) this.users.set(user.email, user);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    const stored = this.users.get(email.toLowerCase());
    if (!stored || !(await argon2.verify(stored.passwordHash, password)))
      throw new UnauthorizedException('Invalid credentials');
    const { passwordHash: _passwordHash, ...user } = stored;
    return { ...(await this.issueSession(user)), user };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    const key = this.hashToken(refreshToken);
    const session = this.refreshSessions.get(key);
    this.refreshSessions.delete(key);
    if (!session || session.expiresAt <= Date.now())
      throw new UnauthorizedException('Refresh session is invalid or expired');
    const user = this.findById(session.userId);
    if (!user) throw new UnauthorizedException('User is unavailable');
    return { ...(await this.issueSession(user)), user };
  }

  logout(refreshToken: string | undefined): void {
    if (refreshToken) this.refreshSessions.delete(this.hashToken(refreshToken));
  }

  findById(id: string): AuthUser | undefined {
    const stored = [...this.users.values()].find((user) => user.id === id);
    if (!stored) return undefined;
    const { passwordHash: _passwordHash, ...user } = stored;
    return user;
  }

  private async issueSession(
    user: AuthUser,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshToken = randomBytes(32).toString('base64url');
    this.refreshSessions.set(this.hashToken(refreshToken), {
      userId: user.id,
      expiresAt: Date.now() + 8 * 60 * 60_000,
    });
    return { accessToken: await this.jwt.signAsync(user), refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
