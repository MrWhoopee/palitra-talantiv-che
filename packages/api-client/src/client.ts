import {
  achievementSchema,
  apiErrorSchema,
  attendanceUpdateSchema,
  authResponseSchema,
  availabilityExceptionSchema,
  availabilityRuleSchema,
  directionSchema,
  galleryItemSchema,
  groupEnrollmentListSchema,
  groupEnrollmentSchema,
  groupListSchema,
  groupSaveResultSchema,
  groupSchema,
  healthResponseSchema,
  lessonAttendanceSchema,
  lessonListSchema,
  lessonSchema,
  locationSchema,
  pricePlanSchema,
  publicTeacherListSchema,
  publicTeacherSchema,
  publicUserSchema,
  slotsResponseSchema,
  subscriptionListSchema,
  studioEventListSchema,
  studioEventSchema,
  subscriptionSchema,
  testimonialSchema,
  BAD_RESPONSE_CODE,
  type Achievement,
  type AuthResponse,
  type AvailabilityException,
  type AvailabilityExceptionInput,
  type AvailabilityRule,
  type AvailabilityRuleInput,
  type AttendanceUpdate,
  type BadResponseCode,
  type BookingRequest,
  type CancelLesson,
  type Direction,
  type DomainErrorCode,
  type GalleryItem,
  type Group,
  type GroupEnrollment,
  type GroupInput,
  type GroupSaveResult,
  type HealthResponse,
  type Lesson,
  type LessonAttendance,
  type Location,
  type LoginRequest,
  type PricePlan,
  type PublicTeacher,
  type PublicUser,
  type RegisterRequest,
  type SlotsResponse,
  type StudioEvent,
  type Subscription,
  type SubscriptionInput,
  type Testimonial,
} from '@palitra/shared';
import { z, type ZodType } from 'zod';

export class ApiClientError extends Error {
  readonly code: DomainErrorCode | BadResponseCode;
  readonly status: number;
  /** Per-field messages from a VALIDATION_FAILED response, when present. */
  readonly fieldErrors: Readonly<Record<string, string[]>>;

  constructor(
    code: DomainErrorCode | BadResponseCode,
    message: string,
    status: number,
    fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export interface ApiClient {
  getHealth(): Promise<HealthResponse>;
  register(input: RegisterRequest): Promise<AuthResponse>;
  login(input: LoginRequest): Promise<AuthResponse>;
  refresh(refreshToken: string): Promise<AuthResponse>;
  logout(refreshToken: string): Promise<void>;
  verifyEmail(token: string): Promise<PublicUser>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
  getMe(accessToken: string): Promise<PublicUser>;

  getTeachers(): Promise<PublicTeacher[]>;
  getTeacher(teacherId: string): Promise<PublicTeacher>;
  getLocations(): Promise<Location[]>;
  getDirections(): Promise<Direction[]>;
  getSlots(teacherId: string, query: SlotQueryInput): Promise<SlotsResponse>;

  getAvailabilityRules(teacherId: string, accessToken: string): Promise<AvailabilityRule[]>;
  createAvailabilityRule(
    teacherId: string,
    input: AvailabilityRuleInput,
    accessToken: string,
  ): Promise<AvailabilityRule>;
  updateAvailabilityRule(
    teacherId: string,
    ruleId: string,
    input: AvailabilityRuleInput,
    accessToken: string,
  ): Promise<AvailabilityRule>;
  deleteAvailabilityRule(teacherId: string, ruleId: string, accessToken: string): Promise<void>;
  getAvailabilityExceptions(
    teacherId: string,
    accessToken: string,
  ): Promise<AvailabilityException[]>;
  createAvailabilityException(
    teacherId: string,
    input: AvailabilityExceptionInput,
    accessToken: string,
  ): Promise<AvailabilityException>;
  deleteAvailabilityException(
    teacherId: string,
    exceptionId: string,
    accessToken: string,
  ): Promise<void>;

  getPricePlans(): Promise<PricePlan[]>;
  createBooking(input: BookingRequest, accessToken: string): Promise<Lesson>;
  getMyLessons(accessToken: string): Promise<Lesson[]>;
  confirmLesson(lessonId: string, accessToken: string): Promise<Lesson>;
  cancelLesson(lessonId: string, input: CancelLesson, accessToken: string): Promise<Lesson>;
  completeLesson(lessonId: string, accessToken: string): Promise<Lesson>;
  markNoShow(lessonId: string, accessToken: string): Promise<Lesson>;

  getMySubscriptions(accessToken: string): Promise<Subscription[]>;
  createSubscription(input: SubscriptionInput, accessToken: string): Promise<Subscription>;
  markSubscriptionPaid(subscriptionId: string, accessToken: string): Promise<Subscription>;
  cancelSubscription(subscriptionId: string, accessToken: string): Promise<Subscription>;

  getGroups(): Promise<Group[]>;
  getGroup(groupId: string): Promise<Group>;
  getMyGroups(accessToken: string): Promise<Group[]>;
  createGroup(input: GroupInput, accessToken: string): Promise<GroupSaveResult>;
  updateGroup(groupId: string, input: GroupInput, accessToken: string): Promise<GroupSaveResult>;
  getGroupEnrollments(groupId: string, accessToken: string): Promise<GroupEnrollment[]>;
  applyToGroup(groupId: string, accessToken: string): Promise<GroupEnrollment>;
  approveEnrollment(
    groupId: string,
    enrollmentId: string,
    accessToken: string,
  ): Promise<GroupEnrollment>;
  removeEnrollment(
    groupId: string,
    enrollmentId: string,
    accessToken: string,
  ): Promise<GroupEnrollment>;

  getAttendance(lessonId: string, accessToken: string): Promise<LessonAttendance>;
  saveAttendance(
    lessonId: string,
    input: AttendanceUpdate,
    accessToken: string,
  ): Promise<LessonAttendance>;

  getDirection(slug: string): Promise<Direction>;
  getEvents(when?: 'upcoming' | 'past' | 'all'): Promise<StudioEvent[]>;
  getEvent(slug: string): Promise<StudioEvent>;
  getGallery(): Promise<GalleryItem[]>;
  getTestimonials(): Promise<Testimonial[]>;
  getAchievements(): Promise<Achievement[]>;
}

/** The query as the caller writes it - the duration is a number, not text. */
export interface SlotQueryInput {
  from: string;
  to: string;
  duration: number;
}

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  accessToken?: string;
  /** Forwarded to the API so a session can be named after the device it runs on. */
  userAgent?: string;
}

export function createApiClient({
  baseUrl,
  fetch: fetchImpl = globalThis.fetch,
}: ApiClientOptions): ApiClient {
  const root = baseUrl.replace(/\/+$/, '');

  async function request(
    path: string,
    { method = 'GET', body, accessToken, userAgent }: RequestOptions = {},
  ): Promise<{ payload: unknown; status: number }> {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (accessToken) {
      headers['authorization'] = `Bearer ${accessToken}`;
    }
    if (userAgent) {
      headers['user-agent'] = userAgent;
    }

    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const payload: unknown =
      response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(payload);
      throw new ApiClientError(
        parsed.success ? parsed.data.code : BAD_RESPONSE_CODE,
        parsed.success ? parsed.data.message : `Request to ${path} failed`,
        response.status,
        parsed.success ? toFieldErrors(parsed.data.details) : {},
      );
    }

    return { payload, status: response.status };
  }

  async function requestParsed<T>(
    schema: ZodType<T>,
    path: string,
    options?: RequestOptions,
  ): Promise<T> {
    const { payload, status } = await request(path, options);
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiClientError(BAD_RESPONSE_CODE, `Unexpected ${path} payload shape`, status);
    }
    return parsed.data;
  }

  return {
    getHealth: () => requestParsed(healthResponseSchema, '/health'),

    register: (input) =>
      requestParsed(authResponseSchema, '/auth/register', { method: 'POST', body: input }),

    login: (input) =>
      requestParsed(authResponseSchema, '/auth/login', { method: 'POST', body: input }),

    refresh: (refreshToken) =>
      requestParsed(authResponseSchema, '/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      }),

    async logout(refreshToken) {
      await request('/auth/logout', { method: 'POST', body: { refreshToken } });
    },

    verifyEmail: (token) =>
      requestParsed(publicUserSchema, '/auth/verify-email', { method: 'POST', body: { token } }),

    async requestPasswordReset(email) {
      await request('/auth/password-reset/request', { method: 'POST', body: { email } });
    },

    async resetPassword(token, password) {
      await request('/auth/password-reset/confirm', { method: 'POST', body: { token, password } });
    },

    getMe: (accessToken) => requestParsed(publicUserSchema, '/auth/me', { accessToken }),

    getTeachers: () => requestParsed(publicTeacherListSchema, '/teachers'),

    getTeacher: (teacherId) =>
      requestParsed(publicTeacherSchema, `/teachers/${encodeURIComponent(teacherId)}`),

    getLocations: () => requestParsed(z.array(locationSchema), '/locations'),

    getDirections: () => requestParsed(z.array(directionSchema), '/directions'),

    getSlots: (teacherId, query) =>
      requestParsed(
        slotsResponseSchema,
        `/teachers/${encodeURIComponent(teacherId)}/slots?${new URLSearchParams({
          from: query.from,
          to: query.to,
          duration: String(query.duration),
        }).toString()}`,
      ),

    getAvailabilityRules: (teacherId, accessToken) =>
      requestParsed(z.array(availabilityRuleSchema), rulesPath(teacherId), { accessToken }),

    createAvailabilityRule: (teacherId, input, accessToken) =>
      requestParsed(availabilityRuleSchema, rulesPath(teacherId), {
        method: 'POST',
        body: input,
        accessToken,
      }),

    updateAvailabilityRule: (teacherId, ruleId, input, accessToken) =>
      requestParsed(
        availabilityRuleSchema,
        `${rulesPath(teacherId)}/${encodeURIComponent(ruleId)}`,
        {
          method: 'PUT',
          body: input,
          accessToken,
        },
      ),

    async deleteAvailabilityRule(teacherId, ruleId, accessToken) {
      await request(`${rulesPath(teacherId)}/${encodeURIComponent(ruleId)}`, {
        method: 'DELETE',
        accessToken,
      });
    },

    getAvailabilityExceptions: (teacherId, accessToken) =>
      requestParsed(z.array(availabilityExceptionSchema), exceptionsPath(teacherId), {
        accessToken,
      }),

    createAvailabilityException: (teacherId, input, accessToken) =>
      requestParsed(availabilityExceptionSchema, exceptionsPath(teacherId), {
        method: 'POST',
        body: input,
        accessToken,
      }),

    async deleteAvailabilityException(teacherId, exceptionId, accessToken) {
      await request(`${exceptionsPath(teacherId)}/${encodeURIComponent(exceptionId)}`, {
        method: 'DELETE',
        accessToken,
      });
    },

    getPricePlans: () => requestParsed(z.array(pricePlanSchema), '/price-plans'),

    createBooking: (input, accessToken) =>
      requestParsed(lessonSchema, '/bookings', { method: 'POST', body: input, accessToken }),

    getMyLessons: (accessToken) => requestParsed(lessonListSchema, '/me/lessons', { accessToken }),

    confirmLesson: (lessonId, accessToken) =>
      requestParsed(lessonSchema, `${lessonPath(lessonId)}/confirm`, {
        method: 'POST',
        accessToken,
      }),

    cancelLesson: (lessonId, input, accessToken) =>
      requestParsed(lessonSchema, `${lessonPath(lessonId)}/cancel`, {
        method: 'POST',
        body: input,
        accessToken,
      }),

    completeLesson: (lessonId, accessToken) =>
      requestParsed(lessonSchema, `${lessonPath(lessonId)}/complete`, {
        method: 'POST',
        accessToken,
      }),

    markNoShow: (lessonId, accessToken) =>
      requestParsed(lessonSchema, `${lessonPath(lessonId)}/no-show`, {
        method: 'POST',
        accessToken,
      }),

    getMySubscriptions: (accessToken) =>
      requestParsed(subscriptionListSchema, '/me/subscriptions', { accessToken }),

    createSubscription: (input, accessToken) =>
      requestParsed(subscriptionSchema, '/subscriptions', {
        method: 'POST',
        body: input,
        accessToken,
      }),

    markSubscriptionPaid: (subscriptionId, accessToken) =>
      requestParsed(subscriptionSchema, `${subscriptionPath(subscriptionId)}/paid`, {
        method: 'POST',
        accessToken,
      }),

    cancelSubscription: (subscriptionId, accessToken) =>
      requestParsed(subscriptionSchema, `${subscriptionPath(subscriptionId)}/cancel`, {
        method: 'POST',
        accessToken,
      }),

    getGroups: () => requestParsed(groupListSchema, '/groups'),

    getGroup: (groupId) => requestParsed(groupSchema, groupPath(groupId)),

    getMyGroups: (accessToken) => requestParsed(groupListSchema, '/me/groups', { accessToken }),

    createGroup: (input, accessToken) =>
      requestParsed(groupSaveResultSchema, '/groups', {
        method: 'POST',
        body: input,
        accessToken,
      }),

    updateGroup: (groupId, input, accessToken) =>
      requestParsed(groupSaveResultSchema, groupPath(groupId), {
        method: 'PUT',
        body: input,
        accessToken,
      }),

    getGroupEnrollments: (groupId, accessToken) =>
      requestParsed(groupEnrollmentListSchema, `${groupPath(groupId)}/enrollments`, {
        accessToken,
      }),

    applyToGroup: (groupId, accessToken) =>
      requestParsed(groupEnrollmentSchema, `${groupPath(groupId)}/enrollments`, {
        method: 'POST',
        accessToken,
      }),

    approveEnrollment: (groupId, enrollmentId, accessToken) =>
      requestParsed(groupEnrollmentSchema, `${enrollmentPath(groupId, enrollmentId)}/approve`, {
        method: 'POST',
        accessToken,
      }),

    removeEnrollment: (groupId, enrollmentId, accessToken) =>
      requestParsed(groupEnrollmentSchema, `${enrollmentPath(groupId, enrollmentId)}/remove`, {
        method: 'POST',
        accessToken,
      }),

    getAttendance: (lessonId, accessToken) =>
      requestParsed(lessonAttendanceSchema, attendancePath(lessonId), { accessToken }),

    saveAttendance: (lessonId, input, accessToken) =>
      requestParsed(lessonAttendanceSchema, attendancePath(lessonId), {
        method: 'PUT',
        body: attendanceUpdateSchema.parse(input),
        accessToken,
      }),

    getDirection: (slug) =>
      requestParsed(directionSchema, `/directions/${encodeURIComponent(slug)}`),

    getEvents: (when = 'upcoming') => requestParsed(studioEventListSchema, `/events?when=${when}`),

    getEvent: (slug) => requestParsed(studioEventSchema, `/events/${encodeURIComponent(slug)}`),

    getGallery: () => requestParsed(z.array(galleryItemSchema), '/gallery'),

    getTestimonials: () => requestParsed(z.array(testimonialSchema), '/testimonials'),

    getAchievements: () => requestParsed(z.array(achievementSchema), '/achievements'),
  };
}

function subscriptionPath(subscriptionId: string): string {
  return `/subscriptions/${encodeURIComponent(subscriptionId)}`;
}

function groupPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}`;
}

function enrollmentPath(groupId: string, enrollmentId: string): string {
  return `${groupPath(groupId)}/enrollments/${encodeURIComponent(enrollmentId)}`;
}

/**
 * The register hangs off the teacher's own lessons rather than off `/lessons`:
 * only the teacher of the group keeps it, and the path says so.
 */
function attendancePath(lessonId: string): string {
  return `/me/lessons/${encodeURIComponent(lessonId)}/attendance`;
}

function lessonPath(lessonId: string): string {
  return `/lessons/${encodeURIComponent(lessonId)}`;
}

function rulesPath(teacherId: string): string {
  return `/teachers/${encodeURIComponent(teacherId)}/availability/rules`;
}

function exceptionsPath(teacherId: string): string {
  return `/teachers/${encodeURIComponent(teacherId)}/availability/exceptions`;
}

/**
 * `details` is typed `unknown` in the shared envelope because different codes
 * carry different shapes; only the validation one is a field map, and anything
 * else is dropped rather than shown to a visitor as-is.
 */
function toFieldErrors(details: unknown): Record<string, string[]> {
  if (typeof details !== 'object' || details === null) {
    return {};
  }

  const result: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(details)) {
    if (Array.isArray(messages) && messages.every((m) => typeof m === 'string')) {
      result[field] = messages;
    }
  }
  return result;
}
