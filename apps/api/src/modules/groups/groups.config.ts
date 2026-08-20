/**
 * How groups are generated. A constant rather than an environment variable,
 * like the rest of the scheduling rules: it describes how the studio works,
 * not where it runs.
 */
export const GROUPS = {
  /**
   * How far ahead an open-ended course generates its meetings. Eight weeks,
   * from the design doc - far enough that the calendar looks full and near
   * enough that a change to the timetable does not have to rewrite a year.
   */
  generationHorizonDays: 56,
} as const;
