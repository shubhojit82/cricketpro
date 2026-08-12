-- CreateEnum
CREATE TYPE "TossDecision" AS ENUM ('BAT', 'BOWL');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "playingTeamSize" INTEGER;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "playingTeamSize" INTEGER NOT NULL DEFAULT 11;

-- CreateTable
CREATE TABLE "MatchToss" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "winnerTeamId" TEXT NOT NULL,
    "decision" "TossDecision" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchToss_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchToss_matchId_key" ON "MatchToss"("matchId");

-- AddForeignKey
ALTER TABLE "MatchToss" ADD CONSTRAINT "MatchToss_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchToss" ADD CONSTRAINT "MatchToss_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
