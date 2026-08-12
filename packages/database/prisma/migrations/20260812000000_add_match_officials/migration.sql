-- CreateEnum
CREATE TYPE "MatchOfficialRole" AS ENUM ('MATCH_REFEREE', 'UMPIRE', 'RESERVE_UMPIRE', 'THIRD_UMPIRE', 'TV_UMPIRE', 'SCORER', 'ASSISTANT_SCORER', 'MATCH_OFFICIAL');

-- CreateTable
CREATE TABLE "MatchOfficial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "role" "MatchOfficialRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchOfficial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchOfficial_matchId_role_name_key"
    ON "MatchOfficial"("matchId", "role", "name");

-- CreateIndex
CREATE INDEX "MatchOfficial_tenantId_idx"
    ON "MatchOfficial"("tenantId");

-- CreateIndex
CREATE INDEX "MatchOfficial_matchId_idx"
    ON "MatchOfficial"("matchId");

-- CreateIndex
CREATE INDEX "MatchOfficial_userId_idx"
    ON "MatchOfficial"("userId");

-- AddForeignKey
ALTER TABLE "MatchOfficial"
    ADD CONSTRAINT "MatchOfficial_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchOfficial"
    ADD CONSTRAINT "MatchOfficial_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchOfficial"
    ADD CONSTRAINT "MatchOfficial_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
