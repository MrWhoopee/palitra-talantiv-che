/**
 * Scheduling constants from the design doc. They live in code rather than in
 * the environment for the same reason the token lifetimes do: they are
 * decisions about how the studio works, not about where it is deployed.
 */
export const SCHEDULING = {
  /** The grid every offered start sits on. */
  slotStepMinutes: 15,
  /**
   * How far ahead the calendar goes. Availability and booking must agree on
   * this to the day - a slot shown but refused on submit is worse than one
   * that was never shown - so both read this one constant.
   */
  bookingHorizonDays: 28,
} as const;
