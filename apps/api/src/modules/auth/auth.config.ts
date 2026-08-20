const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Lifetimes are constants rather than environment variables: they are business
 * decisions from the design doc, identical in every environment. Tests that
 * need a different value pass one into the service instead.
 */
export const AUTH_TTL = {
  /** Short on purpose - a stolen access token cannot be revoked, only outlived. */
  accessTokenSeconds: 15 * MINUTE,
  /** Long enough that a parent booking once a week never has to log in again. */
  refreshTokenSeconds: 30 * DAY,
  /** A verification link that outlives a holiday is still useful. */
  emailVerificationSeconds: 24 * HOUR,
  /** Password resets are answered within minutes or not at all. */
  passwordResetSeconds: 1 * HOUR,
  /**
   * An invitation is the opposite case: it is sent to someone who is not
   * waiting for it and may be on holiday, and until they open it they have no
   * account at all. A week costs little - the link sets a password on an
   * account that has none, so there is nothing behind it to steal.
   */
  inviteSeconds: 7 * DAY,
} as const;
