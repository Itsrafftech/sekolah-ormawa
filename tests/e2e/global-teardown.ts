import { rm } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { E2E_PERIOD_ID } from "./global-setup";

export default async function globalTeardown() {
  // Database isolation is reset atomically at the start of every run. Cleaning
  // it while the Next.js test server still owns connections can deadlock a
  // PostgreSQL TRUNCATE during Playwright shutdown on Windows.
  const root = path.resolve(process.cwd(), "storage", "private");
  const target = path.resolve(root, E2E_PERIOD_ID);
  if (target.startsWith(`${root}${path.sep}`)) await rm(target, { recursive: true, force: true });

  // Next.js dev starts a child process that Playwright cannot always reap on
  // Windows. Stop only the process that is listening on the dedicated E2E port.
  if (process.platform === "win32") {
    const run = promisify(execFile);
    const { stdout } = await run("netstat", ["-ano"]);
    const listener = stdout.split(/\r?\n/u).find((line) =>
      /(?:0\.0\.0\.0|\[::\]):3010\s+.*LISTENING\s+\d+\s*$/u.test(line),
    );
    const processId = listener?.trim().split(/\s+/u).at(-1);
    if (processId && /^\d+$/u.test(processId)) {
      await run("taskkill", ["/pid", processId, "/T", "/F"]).catch(() => undefined);
    }
  }
}
