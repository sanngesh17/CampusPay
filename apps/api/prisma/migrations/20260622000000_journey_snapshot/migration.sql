CREATE TABLE "JourneySnapshot" (
    "id" TEXT NOT NULL,
    "recordJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JourneySnapshot_pkey" PRIMARY KEY ("id")
);
