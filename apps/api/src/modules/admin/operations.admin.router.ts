import {
  adminLessonQuerySchema,
  bookingRequestSchema,
  cancelLessonSchema,
  enrollmentQuerySchema,
  studentQuerySchema,
  subscriptionInputSchema,
} from '@palitra/shared';
import { Router } from 'express';
import { actorOf } from '../../http/actor';
import { pathUuid, withBody, withQuery } from '../../http/middleware/validate';
import type { BookingService } from '../booking/booking.service';
import type { GroupsService } from '../groups/groups.service';
import type { StudentsService } from '../students/students.service';
import type { SubscriptionService } from '../subscriptions/subscriptions.service';

export interface OperationsAdminRouterDeps {
  booking: BookingService;
  groups: GroupsService;
  students: StudentsService;
  subscriptions: SubscriptionService;
}

/**
 * How the studio is run, as opposed to what its site says: the timetable, the
 * packages, the groups, the applications and the people.
 *
 * One file across four modules, which is the opposite of how the content half
 * is arranged, and deliberately. Those modules each grew an admin router
 * because each had a writing half of its own to keep out of a public file.
 * These four have almost no writing half to add: the services already take an
 * `Actor` and already say what an admin may do, so what is missing is not
 * behaviour but a way in. Four files of three routes each would be four places
 * to look for one screen's worth of routes.
 *
 * Nothing here mentions the admin role. Every path is mounted under `/admin`,
 * which is where the guard lives.
 */
export function createOperationsAdminRouter({
  booking,
  groups,
  students,
  subscriptions,
}: OperationsAdminRouterDeps): Router {
  const router = Router();

  router.get(
    '/admin/lessons',
    withQuery(adminLessonQuerySchema, async (query, _req, res) => {
      res.status(200).json(await booking.listSchedule(query));
    }),
  );

  /**
   * Booking on someone's behalf, which is the whole reason this route exists
   * separately from the public one: the same service call, but reached by an
   * actor whose role lets `studentId` mean something.
   */
  router.post(
    '/admin/lessons',
    withBody(bookingRequestSchema, async (input, req, res) => {
      res.status(201).json(await booking.book(actorOf(req), input));
    }),
  );

  /**
   * Calling a lesson off. The other four verbs a lesson has - confirming it,
   * closing it out, marking a no-show - are the teacher's, and they have a
   * cabinet with those buttons in it. This one is the studio's because a
   * parent who rings the studio rings the studio.
   */
  router.post(
    '/admin/lessons/:id/cancel',
    withBody(cancelLessonSchema, async (input, req, res) => {
      res.status(200).json(await booking.cancel(actorOf(req), pathUuid(req, 'id'), input));
    }),
  );

  router.get('/admin/subscriptions', async (req, res) => {
    // The same call the cabinet makes. An admin actor widens it to everything,
    // which is decided in the service, next to the two narrower readings of
    // the same table - so the three cannot drift apart.
    res.status(200).json(await subscriptions.listFor(actorOf(req)));
  });

  /**
   * The three writes a package has. They already exist on the public router
   * behind `requireRole('ADMIN')`, and they are repeated here for the reason
   * the site copy is: the cabinet then has one base address for everything it
   * does, instead of half its calls going to `/admin` and half beside it.
   */
  router.post(
    '/admin/subscriptions',
    withBody(subscriptionInputSchema, async (input, _req, res) => {
      res.status(201).json(await subscriptions.issue(input));
    }),
  );

  router.post('/admin/subscriptions/:id/paid', async (req, res) => {
    res.status(200).json(await subscriptions.markPaid(pathUuid(req, 'id')));
  });

  router.post('/admin/subscriptions/:id/cancel', async (req, res) => {
    res.status(200).json(await subscriptions.cancel(pathUuid(req, 'id')));
  });

  router.get('/admin/groups', async (req, res) => {
    res.status(200).json(await groups.listForActor(actorOf(req)));
  });

  router.get(
    '/admin/enrollments',
    withQuery(enrollmentQuerySchema, async (query, _req, res) => {
      res.status(200).json(await groups.listAllEnrollments(query));
    }),
  );

  router.post('/admin/enrollments/:id/approve', async (req, res) => {
    res.status(200).json(await groups.approve(actorOf(req), pathUuid(req, 'id')));
  });

  router.post('/admin/enrollments/:id/remove', async (req, res) => {
    res.status(200).json(await groups.remove(actorOf(req), pathUuid(req, 'id')));
  });

  router.get(
    '/admin/students',
    withQuery(studentQuerySchema, async (query, _req, res) => {
      res.status(200).json(await students.list(query));
    }),
  );

  return router;
}
