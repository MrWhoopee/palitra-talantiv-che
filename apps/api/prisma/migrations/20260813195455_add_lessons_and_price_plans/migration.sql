-- CreateEnum
CREATE TYPE "LessonFormat" AS ENUM ('INDIVIDUAL', 'GROUP');

-- CreateEnum
CREATE TYPE "LessonKind" AS ENUM ('TRIAL', 'SINGLE', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "PricePlan" (
    "id" UUID NOT NULL,
    "directionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "lessonsCount" INTEGER NOT NULL,
    "durationMinutes" SMALLINT NOT NULL,
    "format" "LessonFormat" NOT NULL DEFAULT 'INDIVIDUAL',
    "priceUah" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "pricePlanId" UUID,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "durationMinutes" SMALLINT NOT NULL,
    "kind" "LessonKind" NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'PENDING',
    "cancelledById" UUID,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricePlan_directionId_idx" ON "PricePlan"("directionId");

-- CreateIndex
CREATE INDEX "Lesson_teacherId_startsAt_idx" ON "Lesson"("teacherId", "startsAt");

-- CreateIndex
CREATE INDEX "Lesson_studentId_startsAt_idx" ON "Lesson"("studentId", "startsAt");

-- CreateIndex
CREATE INDEX "Lesson_status_idx" ON "Lesson"("status");

-- AddForeignKey
ALTER TABLE "PricePlan" ADD CONSTRAINT "PricePlan_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES "Direction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_pricePlanId_fkey" FOREIGN KEY ("pricePlanId") REFERENCES "PricePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A lesson must end after it begins. Cheap, and it keeps a bad range from
-- reaching the exclusion constraint below, where it would behave oddly.
ALTER TABLE "Lesson"
  ADD CONSTRAINT lesson_time_order CHECK ("endsAt" > "startsAt");

-- Stage 4 replaces this with the XOR between "studentId" and "groupId". Until
-- groups exist, every lesson belongs to exactly one student, and the column is
-- already NOT NULL - this constraint only records the intent.
ALTER TABLE "Lesson"
  ADD CONSTRAINT lesson_owner_present CHECK ("studentId" IS NOT NULL);

-- The heart of the booking rules. Two parents pressing "book" on the same slot
-- in the same second both read "free" and both write; no amount of checking in
-- the service closes that window. This makes the second write physically
-- impossible, and the service turns the rejection into a 409.
--
-- Cancelled, completed and no-show lessons are excluded from the constraint on
-- purpose: they no longer hold the teacher's time, so the hour becomes
-- bookable again. Requires the btree_gist extension, enabled in the first
-- migration - "teacherId" is compared with = and needs a gist operator class.
ALTER TABLE "Lesson"
  ADD CONSTRAINT lesson_no_overlap
  EXCLUDE USING gist (
    "teacherId" WITH =,
    tstzrange("startsAt", "endsAt") WITH &&
  ) WHERE (status IN ('PENDING', 'CONFIRMED'));
