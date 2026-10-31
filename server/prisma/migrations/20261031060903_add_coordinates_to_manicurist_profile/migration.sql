/*
  Warnings:

  - Added the required column `latitude` to the `ManicuristProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `longitude` to the `ManicuristProfile` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ManicuristProfile" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "bio" TEXT NOT NULL,
    "imageUrl" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManicuristProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ManicuristProfile" ("address", "bio", "city", "imageUrl", "updatedAt", "userId") SELECT "address", "bio", "city", "imageUrl", "updatedAt", "userId" FROM "ManicuristProfile";
DROP TABLE "ManicuristProfile";
ALTER TABLE "new_ManicuristProfile" RENAME TO "ManicuristProfile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
