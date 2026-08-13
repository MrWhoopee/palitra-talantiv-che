import type { AuthResponse, LoginRequest, PublicUser, RegisterRequest } from '@palitra/shared';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import type { UserModel } from '../../generated/prisma/models';
import { DomainError } from '../../http/error-handler';
import type { AccessTokenService } from '../../lib/access-token';
import type { Mailer } from '../../lib/mailer';
import { DEFAULT_BCRYPT_COST, hashPassword, verifyPassword } from '../../lib/password';
import { createOpaqueToken, hashOpaqueToken } from '../../lib/tokens';
import { AUTH_TTL } from './auth.config';
import { buildPasswordResetMail, buildVerificationMail } from './auth.emails';

const UNIQUE_VIOLATION = 'P2002';

/**
 * A real bcrypt hash of a value nobody can guess. A login for an unknown email
 * is compared against it so that "no such account" and "wrong password" take
 * the same time - otherwise the response latency alone answers "is this person
 * a client of the studio?".
 */
const ABSENT_USER_HASH = '$2b$12$aV1rBhlidZctzvqyR9Dep.s4SkNl0Tyd0msn4Cg8GJxBrT0CGAvFK';

export interface SessionMeta {
  userAgent?: string | undefined;
}

export interface AuthServiceDeps {
  prisma: PrismaClient;
  accessTokens: AccessTokenService;
  mailer: Mailer;
  /** Where the links in outgoing mail point - the web app, not the API. */
  webOrigin: string;
  now?: () => Date;
  bcryptCost?: number;
  ttl?: typeof AUTH_TTL;
}

export interface AuthService {
  register(input: RegisterRequest, meta?: SessionMeta): Promise<AuthResponse>;
  login(input: LoginRequest, meta?: SessionMeta): Promise<AuthResponse>;
  refresh(refreshToken: string, meta?: SessionMeta): Promise<AuthResponse>;
  logout(refreshToken: string): Promise<void>;
  verifyEmail(token: string): Promise<PublicUser>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
  getUser(userId: string): Promise<PublicUser>;
}

export function createAuthService({
  prisma,
  accessTokens,
  mailer,
  webOrigin,
  now = () => new Date(),
  bcryptCost = DEFAULT_BCRYPT_COST,
  ttl = AUTH_TTL,
}: AuthServiceDeps): AuthService {
  function expiryFrom(seconds: number): Date {
    return new Date(now().getTime() + seconds * 1000);
  }

  async function issueSession(user: UserModel, meta: SessionMeta): Promise<AuthResponse> {
    const { token, tokenHash } = createOpaqueToken();

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: expiryFrom(ttl.refreshTokenSeconds),
        userAgent: meta.userAgent ?? null,
      },
    });

    return {
      user: toPublicUser(user),
      accessToken: await accessTokens.sign({ userId: user.id, role: user.role }),
      refreshToken: token,
      accessTokenExpiresIn: accessTokens.ttlSeconds,
    };
  }

  /**
   * Mail is sent on a best-effort basis: an SMTP outage must not turn a
   * successful registration into a 500 the visitor reads as "the studio is
   * broken". The failure is logged; the user can ask for a new link.
   */
  async function sendOneTimeLink(
    user: UserModel,
    kind: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
  ): Promise<void> {
    const { token, tokenHash } = createOpaqueToken();
    const seconds =
      kind === 'EMAIL_VERIFICATION' ? ttl.emailVerificationSeconds : ttl.passwordResetSeconds;

    await prisma.oneTimeToken.create({
      data: { userId: user.id, kind, tokenHash, expiresAt: expiryFrom(seconds) },
    });

    const path = kind === 'EMAIL_VERIFICATION' ? '/verify-email' : '/reset-password';
    const link = `${webOrigin.replace(/\/+$/, '')}${path}?token=${encodeURIComponent(token)}`;
    const context = { to: user.email, firstName: user.firstName, link };

    try {
      await mailer.send(
        kind === 'EMAIL_VERIFICATION'
          ? buildVerificationMail(context)
          : buildPasswordResetMail(context),
      );
    } catch (error) {
      console.error(`Failed to send ${kind} mail`, error);
    }
  }

  async function findUsableToken(token: string, kind: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET') {
    const record = await prisma.oneTimeToken.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
      include: { user: true },
    });

    if (!record || record.kind !== kind || record.usedAt || record.expiresAt <= now()) {
      return null;
    }
    return record;
  }

  return {
    async register(input: RegisterRequest, meta: SessionMeta = {}): Promise<AuthResponse> {
      // Hashing before the insert costs one wasted hash on a duplicate email,
      // and buys the uniqueness decision being made by the database rather
      // than by a check-then-insert that two simultaneous signups can pass.
      const passwordHash = await hashPassword(input.password, bcryptCost);

      let user: UserModel;
      try {
        user = await prisma.user.create({
          data: {
            email: input.email,
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            role: 'STUDENT',
          },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new DomainError('EMAIL_TAKEN', 'Обліковий запис із такою поштою вже існує');
        }
        throw error;
      }

      await sendOneTimeLink(user, 'EMAIL_VERIFICATION');

      // The session is issued immediately, before the email is confirmed: the
      // design doc requires the first booking to work at once, or half the
      // signups die on "check your inbox".
      return issueSession(user, meta);
    },

    async login(input: LoginRequest, meta: SessionMeta = {}): Promise<AuthResponse> {
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      const matches = await verifyPassword(input.password, user?.passwordHash ?? ABSENT_USER_HASH);

      if (!user || !matches) {
        throw new DomainError('INVALID_CREDENTIALS', 'Невірна пошта або пароль');
      }

      return issueSession(user, meta);
    },

    async refresh(refreshToken: string, meta: SessionMeta = {}): Promise<AuthResponse> {
      const existing = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashOpaqueToken(refreshToken) },
        include: { user: true },
      });

      if (!existing) {
        throw new DomainError('INVALID_TOKEN', 'Сесія недійсна, увійдіть знову');
      }

      if (existing.revokedAt) {
        // This token was already rotated, so someone is replaying an old one.
        // We cannot tell a thief from the legitimate owner here, so every
        // session of that user is dropped and both have to log in again.
        await prisma.refreshToken.updateMany({
          where: { userId: existing.userId, revokedAt: null },
          data: { revokedAt: now() },
        });
        throw new DomainError('INVALID_TOKEN', 'Сесія недійсна, увійдіть знову');
      }

      if (existing.expiresAt <= now()) {
        throw new DomainError('INVALID_TOKEN', 'Сесія недійсна, увійдіть знову');
      }

      const { token, tokenHash } = createOpaqueToken();

      await prisma.$transaction(async (tx) => {
        const created = await tx.refreshToken.create({
          data: {
            userId: existing.userId,
            tokenHash,
            expiresAt: expiryFrom(ttl.refreshTokenSeconds),
            userAgent: meta.userAgent ?? existing.userAgent,
          },
        });

        // The `revokedAt: null` guard is what makes rotation atomic: if two
        // requests arrive with the same token, the second updates nothing,
        // rolls back its new token and is told to log in again.
        const rotated = await tx.refreshToken.updateMany({
          where: { id: existing.id, revokedAt: null },
          data: { revokedAt: now(), replacedByTokenId: created.id },
        });

        if (rotated.count === 0) {
          throw new DomainError('INVALID_TOKEN', 'Сесія недійсна, увійдіть знову');
        }
      });

      return {
        user: toPublicUser(existing.user),
        accessToken: await accessTokens.sign({
          userId: existing.user.id,
          role: existing.user.role,
        }),
        refreshToken: token,
        accessTokenExpiresIn: accessTokens.ttlSeconds,
      };
    },

    /** Idempotent: logging out twice, or with a token we never issued, is fine. */
    async logout(refreshToken: string): Promise<void> {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashOpaqueToken(refreshToken), revokedAt: null },
        data: { revokedAt: now() },
      });
    },

    async verifyEmail(token: string): Promise<PublicUser> {
      const record = await findUsableToken(token, 'EMAIL_VERIFICATION');

      if (!record) {
        // A second click on the same link is the common case, not an attack:
        // if the address is already confirmed, say so instead of showing an
        // error for something that did work.
        const spent = await prisma.oneTimeToken.findUnique({
          where: { tokenHash: hashOpaqueToken(token) },
          include: { user: true },
        });
        if (spent?.kind === 'EMAIL_VERIFICATION' && spent.user.emailVerifiedAt) {
          return toPublicUser(spent.user);
        }
        throw new DomainError('INVALID_TOKEN', 'Посилання недійсне або застаріле');
      }

      const at = now();
      const [, user] = await prisma.$transaction([
        prisma.oneTimeToken.update({ where: { id: record.id }, data: { usedAt: at } }),
        prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: at } }),
      ]);

      return toPublicUser(user);
    },

    /**
     * Always resolves, whether or not the address belongs to anyone: a
     * different answer for a known email turns this endpoint into a way to
     * enumerate the studio's clients.
     */
    async requestPasswordReset(email: string): Promise<void> {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return;
      }

      // Only the newest link may work; otherwise every earlier email stays a
      // live key to the account for its full hour.
      await prisma.oneTimeToken.updateMany({
        where: { userId: user.id, kind: 'PASSWORD_RESET', usedAt: null },
        data: { usedAt: now() },
      });

      await sendOneTimeLink(user, 'PASSWORD_RESET');
    },

    async resetPassword(token: string, password: string): Promise<void> {
      const record = await findUsableToken(token, 'PASSWORD_RESET');
      if (!record) {
        throw new DomainError('INVALID_TOKEN', 'Посилання недійсне або застаріле');
      }

      const passwordHash = await hashPassword(password, bcryptCost);
      const at = now();

      await prisma.$transaction([
        prisma.oneTimeToken.update({ where: { id: record.id }, data: { usedAt: at } }),
        prisma.user.update({
          where: { id: record.userId },
          data: {
            passwordHash,
            // Following the link proves control of the mailbox, which is
            // exactly what verification asks for. Leaving it unconfirmed
            // would strand accounts that never opened the first letter.
            emailVerifiedAt: record.user.emailVerifiedAt ?? at,
          },
        }),
        // A reset is what someone does when the account may be compromised,
        // so every existing session goes with the old password.
        prisma.refreshToken.updateMany({
          where: { userId: record.userId, revokedAt: null },
          data: { revokedAt: at },
        }),
      ]);
    },

    async getUser(userId: string): Promise<PublicUser> {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new DomainError('NOT_FOUND', 'Користувача не знайдено');
      }
      return toPublicUser(user);
    },
  };
}

export function toPublicUser(user: UserModel): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;
}
