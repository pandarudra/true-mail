-- CreateTable
CREATE TABLE "HolidayCache" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "year" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HolidayCache_country_region_year_language_key" ON "HolidayCache"("country", "region", "year", "language");
