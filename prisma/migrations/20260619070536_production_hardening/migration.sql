/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `audit_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "deletedAt",
DROP COLUMN "timestamp",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "deletedBy" TEXT;

-- AlterTable
ALTER TABLE "task_comments" ADD COLUMN     "deletedBy" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" TEXT;
