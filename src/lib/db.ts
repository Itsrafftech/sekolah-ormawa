import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnvironment } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: getServerEnvironment().DATABASE_URL,
    // node-postgres defaults to a max pool of 10, which starves concurrent
    // interactive transactions (e.g. Phase 6 candidate lock/unlock under
    // contention) and surfaces as spurious P2028 "expired transaction"
    // errors while callers queue for a free connection. Configurable via
    // DATABASE_CONNECTION_LIMIT (default 20) so the integration test suite
    // can run a smaller pool per test file - see env.ts's doc comment.
    max: getServerEnvironment().DATABASE_CONNECTION_LIMIT,
  });

  return new PrismaClient({
    adapter,
    transactionOptions: {
      // Client-level default `maxWait` for every prisma.$transaction()
      // call in the app (lock.ts, selection.ts, etc.) that doesn't
      // override it itself - see env.ts's doc comment on
      // DATABASE_TRANSACTION_MAX_WAIT_MS.
      maxWait: getServerEnvironment().DATABASE_TRANSACTION_MAX_WAIT_MS,
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Integration tests only. Vitest reuses worker processes across test
 * files (fileParallelism:false does not mean one process per file), so
 * `globalForPrisma.prisma` above - the normal dev-mode hot-reload cache -
 * can end up shared across multiple test files running in the same
 * worker. Calling `prisma.$disconnect()` alone in a file's `afterAll`
 * closed the pool but left that same now-dead client cached in
 * `globalForPrisma.prisma`, so the NEXT file sharing the worker reused a
 * disconnected client instead of getting a fresh one - every query in
 * that file then had to pay a full reconnect (or failed outright),
 * which made 50/60-way concurrency race tests late in the suite *more*
 * likely to blow their connection-acquisition window, not less. This
 * clears the cache slot too, so whichever file (in this worker) needs
 * `prisma` next calls `createPrismaClient()` and gets a live client.
 */
export async function disconnectPrismaForTests(): Promise<void> {
  await prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}
