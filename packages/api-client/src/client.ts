import {
  achievementSchema,
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
  siteSettingsSchema,
  siteTextListSchema,
  slotsResponseSchema,
  subscriptionListSchema,
  studioEventListSchema,
  studioEventSchema,
  subscriptionSchema,
  testimonialSchema,
  type Achievement,
  type AuthResponse,
  type AvailabilityException,
  type AvailabilityExceptionInput,
  type AvailabilityRule,
  type AvailabilityRuleInput,
  type AttendanceUpdate,
  type BookingRequest,
  type CancelLesson,
  type Direction,
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
  type SiteSettings,
  type SiteText,
  type SlotsResponse,
  type StudioEvent,
  type Subscription,
  type SubscriptionInput,
  type Testimonial,
} from '@palitra/shared';
import { z } from 'zod';
import { createHttp, type ApiClientOptions } from './http';

export interface ApiClient {
  getHealth(): Promise<HealthResponse>;
  register(input: RegisterRequest): Promise<AuthResponse>;
  login(input: LoginRequest): Promise<AuthResponse>;
  refresh(refreshToken: string): Promise<AuthResponse>;
  logout(refreshToken: string): Promise<void>;
  verifyEmail(token: string): Promise<PublicUser>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
  /**
   * Unlike a reset, this answers with a session: the person has just proved
   * they hold the mailbox and chosen the password, so there is nothing left to
   * ask them at a login form.
   */
  acceptInvite(token: string, password: string): Promise<AuthResponse>;
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

  /**
   * The studio's own copy, and the facts in the footer of every page.
   *
   * Both ask to be kept rather than fetched again: the footer is on every page
   * of the site, and a call per render would put an API request behind every
   * link a visitor follows. What makes that safe is that the only writer is
   * the cabinet, and every save there names the pages it changed - so the
   * stored copy is replaced the moment it is edited, not a few minutes later.
   */
  getSiteTexts(): Promise<SiteText[]>;
  getSiteSettings(): Promise<SiteSettings>;
}

/** The query as the caller writes it - the duration is a number, not text. */
export interface SlotQueryInput {
  from: string;
  to: string;
  duration: number;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const { request, requestParsed } = createHttp(options);

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

    acceptInvite: (token, password) =>
      requestParsed(authResponseSchema, '/auth/accept-invite', {
        method: 'POST',
        body: { token, password },
      }),

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

    getSiteTexts: () =>
      requestParsed(siteTextListSchema, '/site-texts', { cache: 'force-cache' }),

    getSiteSettings: () =>
      requestParsed(siteSettingsSchema, '/site-settings', { cache: 'force-cache' }),
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

