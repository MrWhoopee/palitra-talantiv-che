'use server';

import {
  loginRequestSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  registerRequestSchema,
} from '@palitra/shared';
import { redirect } from 'next/navigation';
import { flattenError, type output, type ZodType } from 'zod';
import { api } from '@/lib/api';
import { describeError, fieldErrorsOf } from '@/lib/error-messages';
import type { FormState } from '@/lib/form-state';
import { endSession, readRefreshToken, startSession } from '@/lib/session';

/**
 * The forms are validated with the very schemas the API validates against, so
 * a rule can never drift between the two. The server still validates - this
 * pass only saves a round trip and shows the message next to the field.
 */
function parse<S extends ZodType>(
  schema: S,
  formData: FormData,
): { data: output<S> } | { state: FormState } {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (result.success) {
    return { data: result.data };
  }
  return {
    state: {
      error: 'Перевірте заповнені поля.',
      fieldErrors: flattenError(result.error).fieldErrors as Record<string, string[]>,
      values: submittedValues(formData),
    },
  };
}

/** Everything the person typed except the secrets, which are never echoed back. */
const NEVER_ECHOED = new Set(['password', 'token']);

/**
 * Where to go after signing in. Only a path on this site is accepted: a `next`
 * of `https://elsewhere.example` would turn the login screen into an open
 * redirect, and `//elsewhere.example` is the same thing wearing a slash.
 */
function safeNext(formData: FormData): string {
  const value = String(formData.get('next') ?? '');
  return value.startsWith('/') && !value.startsWith('//') ? value : '/cabinet';
}

function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === 'string' && !NEVER_ECHOED.has(name)) {
      values[name] = value;
    }
  }
  return values;
}

export async function registerAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parse(registerRequestSchema, formData);
  if ('state' in parsed) {
    return parsed.state;
  }

  try {
    await startSession(await api.register(parsed.data));
  } catch (error) {
    return {
      error: describeError(error),
      fieldErrors: fieldErrorsOf(error),
      values: submittedValues(formData),
    };
  }

  // Outside the try: `redirect` works by throwing, and catching it here would
  // turn a successful registration into an error message.
  redirect(safeNext(formData));
}

export async function loginAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parse(loginRequestSchema, formData);
  if ('state' in parsed) {
    return parsed.state;
  }

  try {
    await startSession(await api.login(parsed.data));
  } catch (error) {
    return {
      error: describeError(error),
      fieldErrors: fieldErrorsOf(error),
      values: submittedValues(formData),
    };
  }

  redirect(safeNext(formData));
}

export async function logoutAction(): Promise<never> {
  const refreshToken = await readRefreshToken();

  if (refreshToken) {
    try {
      await api.logout(refreshToken);
    } catch (error) {
      // The session must end on this device even if the API cannot be
      // reached; the token dies of old age server-side.
      console.error('Logout request failed', error);
    }
  }

  await endSession();
  redirect('/login');
}

export async function requestPasswordResetAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parse(passwordResetRequestSchema, formData);
  if ('state' in parsed) {
    return parsed.state;
  }

  try {
    await api.requestPasswordReset(parsed.data.email);
  } catch (error) {
    return { error: describeError(error), values: submittedValues(formData) };
  }

  // Deliberately the same answer for an address we know and one we do not -
  // the API keeps that secret, and the interface must not give it away.
  return { done: true };
}

/**
 * The other end of an invitation. Same fields as a reset and the same schema,
 * but it finishes signed in rather than at a login form: the teacher has just
 * proved they hold the mailbox and chosen the password, and asking them to
 * type it again immediately would be a form for its own sake.
 */
export async function acceptInviteAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parse(passwordResetSchema, formData);
  if ('state' in parsed) {
    return parsed.state;
  }

  try {
    await startSession(await api.acceptInvite(parsed.data.token, parsed.data.password));
  } catch (error) {
    return {
      error: describeError(error),
      fieldErrors: fieldErrorsOf(error),
      values: submittedValues(formData),
    };
  }

  redirect('/cabinet');
}

export async function resetPasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parse(passwordResetSchema, formData);
  if ('state' in parsed) {
    return parsed.state;
  }

  try {
    await api.resetPassword(parsed.data.token, parsed.data.password);
  } catch (error) {
    return {
      error: describeError(error),
      fieldErrors: fieldErrorsOf(error),
      values: submittedValues(formData),
    };
  }

  return { done: true };
}
