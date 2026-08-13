import { ApiClientError } from '@palitra/api-client';
import type { DomainErrorCode } from '@palitra/shared';

/**
 * The API's messages are already in Ukrainian, but the interface reads them by
 * code rather than printing whatever the server said: the wording of a screen
 * belongs to the screen, and the mobile client will need the same mapping
 * without shipping the API's strings.
 */
const MESSAGES: Partial<Record<DomainErrorCode, string>> = {
  EMAIL_TAKEN: 'Обліковий запис із такою поштою вже існує. Спробуйте увійти.',
  INVALID_CREDENTIALS: 'Невірна пошта або пароль.',
  INVALID_TOKEN: 'Посилання недійсне або застаріло. Запросіть нове.',
  UNAUTHENTICATED: 'Сесія завершилася. Увійдіть знову.',
  FORBIDDEN: 'Недостатньо прав для цієї дії.',
  TOO_MANY_REQUESTS: 'Забагато спроб поспіль. Спробуйте за кілька хвилин.',
  VALIDATION_FAILED: 'Перевірте заповнені поля.',
  NOT_FOUND: 'Не знайдено.',
};

const FALLBACK = 'Не вдалося виконати дію. Спробуйте ще раз за хвилину.';

export function describeError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return MESSAGES[error.code as DomainErrorCode] ?? FALLBACK;
  }
  // A network failure or an API that is simply down: the visitor gets the
  // same neutral sentence, and the detail goes to the server log.
  return FALLBACK;
}

export function fieldErrorsOf(error: unknown): Record<string, string[]> {
  return error instanceof ApiClientError ? { ...error.fieldErrors } : {};
}
