/** Recomputes final scores for one session. Used to verify scoring changes. */
import { prisma } from '../src/lib/db';
import { computeFinalScores } from '../src/lib/scoring';

async function main() {
  const sessionId = process.argv[2];
  if (!sessionId) throw new Error('Usage: rescore-session.ts <sessionId>');
  await computeFinalScores(sessionId);
  console.log('rescored', sessionId);
  await prisma.$disconnect();
}
main();
