import type { Lesson, PublicUser } from '@palitra/shared';
import {
  cancelLessonAction,
  completeLessonAction,
  confirmLessonAction,
  noShowLessonAction,
} from '@/app/actions/booking';
import { lessonMoment } from '@/lib/studio-time';

const KIND_LABELS: Record<Lesson['kind'], string> = {
  TRIAL: 'Пробне',
  SINGLE: 'Разове',
  SUBSCRIPTION: 'З абонемента',
};

const STATUS_LABELS: Record<Lesson['status'], string> = {
  PENDING: 'Очікує підтвердження',
  CONFIRMED: 'Підтверджено',
  COMPLETED: 'Проведено',
  CANCELLED: 'Скасовано',
  NO_SHOW: 'Не прийшов',
};

const STATUS_TONES: Record<Lesson['status'], string> = {
  PENDING: 'badge-wait',
  CONFIRMED: 'badge-ok',
  COMPLETED: 'badge-done',
  CANCELLED: 'badge-off',
  NO_SHOW: 'badge-off',
};

/** The window inside which a student has to ask the teacher instead. */
const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function LessonCard({ lesson, user, now }: { lesson: Lesson; user: PublicUser; now: Date }) {
  const startsAt = new Date(lesson.startsAt);
  const teachesIt = lesson.teacher.id === user.id || user.role === 'ADMIN';
  const attendsIt = lesson.student.id === user.id;
  const open = lesson.status === 'PENDING' || lesson.status === 'CONFIRMED';

  const studentMayCancel =
    attendsIt && !teachesIt && startsAt.getTime() - now.getTime() >= CANCELLATION_WINDOW_MS;

  return (
    <article className="lesson">
      <div className="lesson-when">
        <span className="lesson-time">{lessonMoment(startsAt)}</span>
        <span className="lesson-duration">{lesson.durationMinutes} хв</span>
      </div>

      <div className="lesson-body">
        <p className="lesson-line">
          <span className={`badge ${STATUS_TONES[lesson.status]}`}>
            {STATUS_LABELS[lesson.status]}
          </span>
          <span className="badge badge-kind">{KIND_LABELS[lesson.kind]}</span>
          {lesson.directionName ? (
            <span className="badge badge-kind">{lesson.directionName}</span>
          ) : null}
        </p>

        <p className="lesson-line lesson-people">
          {teachesIt ? (
            <>
              Учень: <strong>{`${lesson.student.firstName} ${lesson.student.lastName}`}</strong>
              {' · '}
              <a href={`tel:${lesson.student.phone}`}>{lesson.student.phone}</a>
            </>
          ) : (
            <>
              Викладач: <strong>{`${lesson.teacher.firstName} ${lesson.teacher.lastName}`}</strong>
            </>
          )}
        </p>

        <p className="lesson-line lesson-place">
          {lesson.location.name} — {lesson.location.address}
        </p>

        {lesson.cancelReason ? (
          <p className="lesson-line lesson-reason">Причина: {lesson.cancelReason}</p>
        ) : null}
      </div>

      <div className="lesson-actions">
        {teachesIt && lesson.status === 'PENDING' ? (
          <ActionButton action={confirmLessonAction} lessonId={lesson.id} tone="primary">
            Підтвердити
          </ActionButton>
        ) : null}

        {/* Marking the outcome is what will draw a lesson from a subscription
            in stage 4, so the buttons appear only once the lesson has begun. */}
        {teachesIt && lesson.status === 'CONFIRMED' && startsAt <= now ? (
          <>
            <ActionButton action={completeLessonAction} lessonId={lesson.id} tone="primary">
              Проведено
            </ActionButton>
            <ActionButton action={noShowLessonAction} lessonId={lesson.id}>
              Не прийшов
            </ActionButton>
          </>
        ) : null}

        {open && (teachesIt || studentMayCancel) ? (
          <ActionButton action={cancelLessonAction} lessonId={lesson.id}>
            Скасувати
          </ActionButton>
        ) : null}

        {open && attendsIt && !teachesIt && !studentMayCancel ? (
          <p className="lesson-hint">
            До заняття менше доби — скасувати можна лише через викладача.
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * A form rather than a link or an onClick: each of these changes server state,
 * so none of them may be reachable by a prefetch, and all of them keep working
 * with JavaScript switched off.
 */
function ActionButton({
  action,
  lessonId,
  tone,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  lessonId: string;
  tone?: 'primary';
  children: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <button type="submit" className={tone === 'primary' ? 'button-primary' : 'button-quiet'}>
        {children}
      </button>
    </form>
  );
}
