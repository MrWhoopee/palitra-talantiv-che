-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "subscriptionId" UUID;

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "pricePlanId" UUID NOT NULL,
    "lessonsTotal" SMALLINT NOT NULL,
    "lessonsUsed" SMALLINT NOT NULL DEFAULT 0,
    "priceUah" INTEGER NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,
    "paidAt" TIMESTAMPTZ(3),
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscription_studentId_status_idx" ON "Subscription"("studentId", "status");

-- CreateIndex
CREATE INDEX "Subscription_teacherId_idx" ON "Subscription"("teacherId");

-- CreateIndex
CREATE INDEX "Lesson_subscriptionId_idx" ON "Lesson"("subscriptionId");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_pricePlanId_fkey" FOREIGN KEY ("pricePlanId") REFERENCES "PricePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A package of nothing cannot be sold, and the used count can never pass the
-- total. The second half is the one that matters: drawing a lesson is an
-- increment done from application code, and a bug that draws twice would
-- silently eat a lesson someone paid for. Here it fails loudly instead.
ALTER TABLE "Subscription"
  ADD CONSTRAINT subscription_lessons_range
  CHECK ("lessonsTotal" > 0 AND "lessonsUsed" >= 0 AND "lessonsUsed" <= "lessonsTotal");

ALTER TABLE "Subscription"
  ADD CONSTRAINT subscription_validity_order CHECK ("validTo" >= "validFrom");

-- The price is recorded in whole hryvnias, and a negative one is a data entry
-- slip rather than a discount.
ALTER TABLE "Subscription"
  ADD CONSTRAINT subscription_price_nonnegative CHECK ("priceUah" >= 0);
