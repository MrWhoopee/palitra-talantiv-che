-- CreateEnum
CREATE TYPE "GroupEnrollmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "groupId" UUID,
ALTER COLUMN "studentId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Group" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "teacherId" UUID NOT NULL,
    "directionId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "capacity" SMALLINT NOT NULL,
    "durationMinutes" SMALLINT NOT NULL,
    "isOpenForEnrollment" BOOLEAN NOT NULL DEFAULT true,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSchedule" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "startMinute" SMALLINT NOT NULL,

    CONSTRAINT "GroupSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupEnrollment" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "GroupEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(3),

    CONSTRAINT "GroupEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonAttendance" (
    "lessonId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "markedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonAttendance_pkey" PRIMARY KEY ("lessonId","studentId")
);

-- CreateIndex
CREATE INDEX "Group_teacherId_idx" ON "Group"("teacherId");

-- CreateIndex
CREATE INDEX "Group_directionId_idx" ON "Group"("directionId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSchedule_groupId_weekday_startMinute_key" ON "GroupSchedule"("groupId", "weekday", "startMinute");

-- CreateIndex
CREATE INDEX "GroupEnrollment_studentId_idx" ON "GroupEnrollment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupEnrollment_groupId_studentId_key" ON "GroupEnrollment"("groupId", "studentId");

-- CreateIndex
CREATE INDEX "LessonAttendance_studentId_idx" ON "LessonAttendance"("studentId");

-- CreateIndex
CREATE INDEX "Lesson_groupId_startsAt_idx" ON "Lesson"("groupId", "startsAt");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES "Direction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSchedule" ADD CONSTRAINT "GroupSchedule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupEnrollment" ADD CONSTRAINT "GroupEnrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupEnrollment" ADD CONSTRAINT "GroupEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonAttendance" ADD CONSTRAINT "LessonAttendance_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonAttendance" ADD CONSTRAINT "LessonAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The placeholder from the lessons migration said "exactly one owner" at a
-- time when there was only one kind of owner. Now there are two, and the rule
-- can finally be written as it was always meant to be: a lesson with neither
-- owner is invisible in every cabinet, and one with both would be counted
-- twice - once as an individual lesson and once as a group meeting.
ALTER TABLE "Lesson" DROP CONSTRAINT lesson_owner_present;

ALTER TABLE "Lesson"
  ADD CONSTRAINT lesson_owner_xor
  CHECK (("studentId" IS NULL) <> ("groupId" IS NULL));

-- A group of one is an individual lesson, and the upper bound matches
-- MAX_GROUP_CAPACITY in the shared contracts - the studio's rooms do not hold
-- more than that.
ALTER TABLE "Group"
  ADD CONSTRAINT group_capacity_range CHECK ("capacity" BETWEEN 2 AND 20);

ALTER TABLE "Group"
  ADD CONSTRAINT group_dates_order CHECK ("endsOn" IS NULL OR "endsOn" >= "startsOn");

-- The same bounds the availability rules carry: a weekday is 0-6 and a time of
-- day is minutes since local midnight.
ALTER TABLE "GroupSchedule"
  ADD CONSTRAINT group_schedule_weekday_range CHECK ("weekday" BETWEEN 0 AND 6);

ALTER TABLE "GroupSchedule"
  ADD CONSTRAINT group_schedule_minute_range CHECK ("startMinute" BETWEEN 0 AND 1439);

-- A row that says someone left with no date, or that they left while still
-- listed as active, is a half-applied change rather than a state of the world.
ALTER TABLE "GroupEnrollment"
  ADD CONSTRAINT group_enrollment_left_at CHECK (("status" = 'LEFT') = ("leftAt" IS NOT NULL));
