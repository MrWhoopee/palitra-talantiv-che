const HOUR = 60 * 60 * 1000;

/**
 * Booking rules from the design doc. Constants rather than environment
 * variables: they describe how the studio works, not where it runs.
 */
export const BOOKING = {
  /**
   * How close to the lesson a student may still cancel on their own. Later
   * than this they have to reach the teacher, and stage 4 will charge the
   * lesson against their subscription.
   */
  cancellationWindowMs: 24 * HOUR,
} as const;
