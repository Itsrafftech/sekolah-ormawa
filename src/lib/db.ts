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
    // errors while callers queue for a free connection.
    max: 20,
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
