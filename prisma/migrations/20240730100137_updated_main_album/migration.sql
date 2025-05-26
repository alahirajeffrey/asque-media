/*
  Warnings:

  - You are about to drop the column `albumImageUris` on the `Album` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Album` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Album` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Album" DROP COLUMN "albumImageUris",
DROP COLUMN "category",
DROP COLUMN "description";
