import { USER_ROLES, type UserRole } from '@palitra/shared';
import { jwtVerify, SignJWT } from 'jose';

export const ACCESS_TOKEN_ISSUER = 'palitra-api';
export const ACCESS_TOKEN_AUDIENCE = 'palitra-clients';

const ALGORITHM = 'HS256';

export interface AccessTokenClaims {
  userId: string;
  role: UserRole;
}

export interface AccessTokenService {
  sign(claims: AccessTokenClaims): Promise<string>;
  /** Returns `null` for every kind of invalid token - see below. */
  verify(token: string): Promise<AccessTokenClaims | null>;
  readonly ttlSeconds: number;
}

export interface AccessTokenServiceOptions {
  secret: string;
  ttlSeconds: number;
}

export function createAccessTokenService({
  secret,
  ttlSeconds,
}: AccessTokenServiceOptions): AccessTokenService {
  const key = new TextEncoder().encode(secret);

  return {
    ttlSeconds,

    async sign({ userId, role }: AccessTokenClaims): Promise<string> {
      const issuedAt = Math.floor(Date.now() / 1000);

      return new SignJWT({ role })
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(userId)
        .setIssuer(ACCESS_TOKEN_ISSUER)
        .setAudience(ACCESS_TOKEN_AUDIENCE)
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + ttlSeconds)
        .sign(key);
    },

    /**
     * Expired, forged, malformed, wrong issuer, unknown role - all collapse to
     * `null`. The caller answers `UNAUTHENTICATED` either way: telling a
     * caller *why* a token failed helps only someone probing the API.
     */
    async verify(token: string): Promise<AccessTokenClaims | null> {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: [ALGORITHM],
          issuer: ACCESS_TOKEN_ISSUER,
          audience: ACCESS_TOKEN_AUDIENCE,
        });

        const role = payload['role'];
        if (typeof payload.sub !== 'string' || !isUserRole(role)) {
          return null;
        }

        return { userId: payload.sub, role };
      } catch {
        return null;
      }
    },
  };
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}
