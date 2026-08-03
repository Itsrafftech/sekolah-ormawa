import "dotenv/config";

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  console.error("TEST_DATABASE_URL wajib untuk E2E.");
  process.exit(1);
}

const appEnvironment = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  NEXT_PUBLIC_APP_URL: "http://localhost:3010",
  REGISTRATION_SUBMISSION_ENABLED: "true",
  NODE_ENV: "development",
};

const server = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "dev", "--port", "3010"],
  { env: appEnvironment, stdio: "inherit" },
);

async function waitUntilReady() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) throw new Error("Server E2E berhenti sebelum siap.");
    try {
      const response = await fetch("http://localhost:3010/api/health");
      if (response.ok) return;
    } catch {
      // Server masih melakukan boot/compile.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Server E2E tidak siap dalam 60 detik.");
}

async function warmApplicationRoutes() {
  const paths = [
    "/admin/login",
    "/admin/ganti-password",
    "/admin/lupa-password",
    "/admin/reset-password?token=invalid-warmup",
    "/admin/dashboard",
    "/api/admin/auth/login",
    "/api/admin/auth/change-password",
    "/api/admin/auth/forgot-password",
    "/api/admin/auth/reset-password",
    "/api/admin/auth/logout",
    "/api/auth/sign-in/email",
    "/daftar",
    "/daftar/sukses?token=invalid-warmup",
    "/api/registration/uploads",
    "/api/registration/submit",
  ];
  await Promise.all(paths.map((path) =>
    fetch(`http://localhost:3010${path}`).catch(() => undefined),
  ));
}

async function stopServer() {
  if (process.platform === "win32" && server.pid) {
    await promisify(execFile)("taskkill", ["/pid", String(server.pid), "/T", "/F"])
      .catch(() => undefined);
  } else if (!server.killed) {
    server.kill("SIGTERM");
  }
}

let exitCode = 1;
try {
  await waitUntilReady();
  await warmApplicationRoutes();
  const playwright = spawn(
    process.execPath,
    ["./node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    { env: appEnvironment, stdio: "inherit" },
  );
  exitCode = await new Promise((resolve) => playwright.on("exit", (code) => resolve(code ?? 1)));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Runner E2E gagal.");
} finally {
  await stopServer();
}

process.exit(exitCode);
