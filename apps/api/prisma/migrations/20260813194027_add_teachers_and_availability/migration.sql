-- CreateEnum
CREATE TYPE "AvailabilityExceptionKind" AS ENUM ('VACATION', 'SICK', 'BLOCKED');

-- CreateTable
CREATE TABLE "Location" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "mapUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Direction" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Direction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "userId" UUID NOT NULL,
    "bio" TEXT,
    "experienceYears" INTEGER,
    "photoUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TeacherLocation" (
    "teacherId" UUID NOT NULL,
    "locationId" UUID NOT NULL,

    CONSTRAINT "TeacherLocation_pkey" PRIMARY KEY ("teacherId","locationId")
);

-- CreateTable
CREATE TABLE "TeacherDirection" (
    "teacherId" UUID NOT NULL,
    "directionId" UUID NOT NULL,

    CONSTRAINT "TeacherDirection_pkey" PRIMARY KEY ("teacherId","directionId")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "startMinute" SMALLINT NOT NULL,
    "endMinute" SMALLINT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "kind" "AvailabilityExceptionKind" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Direction_slug_key" ON "Direction"("slug");

-- CreateIndex
CREATE INDEX "TeacherLocation_locationId_idx" ON "TeacherLocation"("locationId");

-- CreateIndex
CREATE INDEX "TeacherDirection_directionId_idx" ON "TeacherDirection"("directionId");

-- CreateIndex
CREATE INDEX "AvailabilityRule_teacherId_weekday_idx" ON "AvailabilityRule"("teacherId", "weekday");

-- CreateIndex
CREATE INDEX "AvailabilityException_teacherId_startsAt_idx" ON "AvailabilityException"("teacherId", "startsAt");

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLocation" ADD CONSTRAINT "TeacherLocation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLocation" ADD CONSTRAINT "TeacherLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDirection" ADD CONSTRAINT "TeacherDirection_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDirection" ADD CONSTRAINT "TeacherDirection_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES "Direction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bounds that Prisma cannot express declaratively. They belong in the
-- database rather than only in zod: the seed script, a migration and a psql
-- session all write through the same table, and none of them goes through the
-- HTTP schemas.
ALTER TABLE "AvailabilityRule"
  ADD CONSTRAINT availability_rule_weekday_range CHECK ("weekday" BETWEEN 0 AND 6);

ALTER TABLE "AvailabilityRule"
  ADD CONSTRAINT availability_rule_minutes_range CHECK (
    "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute"
  );

ALTER TABLE "AvailabilityRule"
  ADD CONSTRAINT availability_rule_validity_order CHECK (
    "validTo" IS NULL OR "validTo" >= "validFrom"
  );

ALTER TABLE "AvailabilityException"
  ADD CONSTRAINT availability_exception_order CHECK ("endsAt" > "startsAt");
