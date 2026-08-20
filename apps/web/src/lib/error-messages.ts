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
  SLOT_TAKEN: 'Цей час щойно зайняли. Оберіть інший зі списку вільних.',
  TRIAL_ALREADY_USED: 'Безкоштовне пробне заняття можна відвідати один раз.',
  TOO_LATE_TO_CANCEL: 'До заняття лишилося менше доби — скасувати можна лише через викладача.',
  SUBSCRIPTION_EXHAUSTED: 'В абонементі не лишилося занять. Оформіть новий у студії.',
  NO_ACTIVE_SUBSCRIPTION: 'Цей абонемент не діє на обрану дату.',
  GROUP_FULL: 'У групі немає вільних місць.',
  ALREADY_ENROLLED: 'Ви вже подали заявку до цієї групи.',
  OUTSIDE_BOOKING_HORIZON: 'Записатися можна не далі ніж на чотири тижні вперед.',
  EMAIL_NOT_VERIFIED: 'Підтвердіть пошту — ми надсилаємо на неї нагадування про заняття.',
  INVALID_LESSON_STATUS: 'Цю дію вже не можна виконати для цього заняття.',
  NOT_TEACHER_OWNED: 'Це заняття або група іншого викладача.',
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
