/**
 * Lives outside the `'use server'` module on purpose: that file may export
 * async functions and nothing else, so the initial state a form starts from
 * cannot be declared next to the actions that produce it.
 */
export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  done?: boolean;
  /**
   * What was submitted, so a rejected form comes back filled in. React resets
   * a form after an action runs, and retyping a name, a phone and an email
   * because the password was too short is exactly the friction that makes
   * people give up halfway. Passwords and tokens are never echoed back.
   */
  values?: Record<string, string>;
}

export const emptyFormState: FormState = {};
