import "dotenv/config";

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    // Headroom above PRISMA_TRANSACTION_TIMEOUT_MS below (30s) so Vitest's
    // own per-test/per-hook clock never cuts off a race test before the
    // Prisma transaction's own deadline gets a chance to fire first.
    hookTimeout: 45_000,
    testTimeout: 45_000,
    // See DECISIONS.md ADR-042 for the full diagnosis of why the two
    // 50/60-way concurrency race tests (candidate-lock F6-01,
    // selection-decision SEL-04) were flaky only under the full 13-file
    // sequential suite, never standalone: NOT connection-pool exhaustion
    // (the original hypothesis) - P2028 was firing at ~15.2-15.4s,
    // matching lock.ts/selection.ts's $transaction `timeout` almost
    // exactly. The env vars below are test-only overrides of app defaults
    // that stay untouched for dev/prod (src/lib/env.ts documents each):
    env: {
      // Each test file's dynamic `await import("@/lib/db")` can share the
      // app's dev-mode Prisma client cache across files when Vitest
      // reuses a worker (fileParallelism:false is not one-process-per-
      // file) - every file now closes it via disconnectPrismaForTests()
      // in afterAll (src/lib/db.ts), so a smaller per-client pool here
      // keeps the 13-file sequential suite's worst case comfortably under
      // Postgres's max_connections (100 on the local dev/test instance).
      DATABASE_CONNECTION_LIMIT: "10",
      // Prisma's stock 2000ms connection-acquisition window, widened as
      // defense-in-depth; not the actual bottleneck (see ADR-042) but no
      // reason to leave it tight for tests.
      DATABASE_TRANSACTION_MAX_WAIT_MS: "10000",
      // The actual fix (ADR-042): lock.ts/selection.ts's $transaction
      // BODY deadline, raised from the 15000ms production default to give
      // 50-60 transactions serialized on one contended row enough room to
      // fully drain their Postgres row-lock queue under this environment's
      // slower I/O late in a long sequential run.
      PRISMA_TRANSACTION_TIMEOUT_MS: "30000",
    },
  },
});
