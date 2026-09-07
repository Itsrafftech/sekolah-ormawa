import { z } from "zod";

const numberFromEnvironment = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);

const serverEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  // Pool size for the shared Prisma client's node-postgres adapter
  // (src/lib/db.ts). Default 20 is sized for the app/dev/prod runtime.
  // Integration tests override this lower (vitest.integration.config.ts)
  // so that each test file's Prisma client - which, absent an explicit
  // prisma.$disconnect() in afterAll, can otherwise leave its pool's
  // connections open past that file's run - can't alone consume a large
  // share of Postgres's max_connections across a long sequential suite.
  DATABASE_CONNECTION_LIMIT: numberFromEnvironment(20),
  // How long prisma.$transaction() will queue for a free pooled connection
  // before giving up (Prisma's own default is 2000ms - unset here, not a
  // deliberate app choice). Kept as defense-in-depth for the integration
  // test suite (vitest.integration.config.ts raises it) - not the actual
  // fix for the 50/60-way concurrency race tests' flakiness under the full
  // sequential suite; see PRISMA_TRANSACTION_TIMEOUT_MS below and
  // DECISIONS.md ADR-042 for the real root cause and fix.
  DATABASE_TRANSACTION_MAX_WAIT_MS: numberFromEnvironment(2000),
  // How long prisma.$transaction()'s BODY (not connection acquisition -
  // see DATABASE_TRANSACTION_MAX_WAIT_MS above) is allowed to run before
  // Prisma cancels it (P2028). lock.ts/selection.ts's $transaction calls
  // read this instead of a hardcoded literal specifically so the
  // integration test suite can raise it without touching those files'
  // logic. Default 15000ms matches this app's original/production value
  // (ADR-042); the integration test suite overrides it to 30000ms
  // (vitest.integration.config.ts) because 50-60 transactions serialized
  // on one contended row apparently need more than 15s to fully drain
  // their Postgres row-lock queue once enough prior I/O has accumulated
  // in a long sequential run under this environment's Docker Desktop/
  // Windows storage layer - see ADR-042 for the full diagnosis.
  PRISMA_TRANSACTION_TIMEOUT_MS: numberFromEnvironment(15000),
  AUTH_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().min(1).default("sekolah_session"),
  SESSION_MAX_AGE_SECONDS: numberFromEnvironment(900),
  SESSION_IDLE_TIMEOUT_SECONDS: numberFromEnvironment(900),
  SESSION_UPDATE_AGE_SECONDS: numberFromEnvironment(300),
  PASSWORD_RESET_TTL_SECONDS: numberFromEnvironment(3600),
  TEMP_PASSWORD_TTL_SECONDS: numberFromEnvironment(86400),
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: numberFromEnvironment(60),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: numberFromEnvironment(5),
  PASSWORD_MAX_LENGTH: numberFromEnvironment(128),
  IP_HASH_SECRET: z.string().min(16),
  REGISTRATION_SUBMISSION_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  REGISTRATION_DRAFT_TTL_SECONDS: numberFromEnvironment(604800),
  REGISTRATION_UPLOAD_TTL_SECONDS: numberFromEnvironment(86400),
  REGISTRATION_CONFIRMATION_TTL_SECONDS: numberFromEnvironment(900),
  MOTIVATION_MIN_WORDS: numberFromEnvironment(100),
  ESSAY_MIN_WORDS: numberFromEnvironment(1),
  ESSAY_MAX_WORDS: numberFromEnvironment(1000),
  // Phase D - "Portofolio via URL Google Drive" (ADR-045): PORTFOLIO_MAX_FILES
  // and PORTFOLIO_MAX_FILE_BYTES (file-upload caps from Phase 3/C) and
  // BUDGET_PLAN_MAX_FILE_BYTES (Phase C) were retired along with the
  // in-app upload mechanism for Medbrand/Badmedbrnd/Komanggar - all three
  // now use a plain Google Drive URL instead. PORTFOLIO_URL_MAX_LENGTH is
  // kept and reused as the max length for that URL string (was previously
  // the max length of an EXTERNAL_LINK portfolio item's URL - same kind
  // of value, just the only kind now).
  PORTFOLIO_URL_MAX_LENGTH: numberFromEnvironment(2048),
  // "Perubahan Sistem Pembayaran": single fixed registration fee in
  // Rupiah shown to every registrant (was previously a per-registrant
  // unique code added to a base amount - see ADR-048). Env-driven like the
  // content-policy values above so the org can change the fee without a
  // code change.
  PAYMENT_AMOUNT: numberFromEnvironment(15001),
  STORAGE_PRIVATE_ROOT: z.string().min(1).default("private"),
  STORAGE_SIGNED_URL_TTL_SECONDS: numberFromEnvironment(300),
  // Phase 9: MinIO (self-hosted, S3-compatible) is the production private
  // storage provider (replaces the earlier Supabase Storage plan - see
  // ADR-035). All optional here so development/test (which use
  // DevelopmentPrivateStorage, local disk) never need them; enforced
  // present in the superRefine below when NODE_ENV=production.
  STORAGE_BUCKET_CANDIDATES: z.string().min(1).default("sekolah-candidates-private"),
  MINIO_ENDPOINT: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.url().optional(),
  ),
  MINIO_REGION: z.string().min(1).default("us-east-1"),
  MINIO_ACCESS_KEY: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
  MINIO_SECRET_KEY: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
  EMAIL_SINK_ROOT: z.string().min(1).default("email-sink"),
  EMAIL_OUTBOX_MAX_ATTEMPTS: numberFromEnvironment(5),
  // Phase 9: Resend is the production email provider (replaces the
  // dev-only local sink). Optional here for the same reason as the MinIO
  // vars above; enforced present in production in the superRefine below.
  RESEND_API_KEY: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
  RESEND_FROM_EMAIL: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.email().optional(),
  ),
  CRON_SECRET: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(32).optional(),
  ),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
}).superRefine((environment, context) => {
  if (
    environment.NODE_ENV === "production" &&
    environment.REGISTRATION_SUBMISSION_ENABLED &&
    environment.AUTH_SECRET.length < 48
  ) {
    context.addIssue({
      code: "custom",
      message: "AUTH_SECRET production harus minimal 48 karakter saat submission aktif.",
      path: ["AUTH_SECRET"],
    });
  }
  if (environment.NODE_ENV === "production") {
    for (const key of ["MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY"] as const) {
      if (!environment[key]) {
        context.addIssue({
          code: "custom",
          message: `${key} wajib di production (adapter storage MinIO).`,
          path: [key],
        });
      }
    }
    for (const key of ["RESEND_API_KEY", "RESEND_FROM_EMAIL"] as const) {
      if (!environment[key]) {
        context.addIssue({
          code: "custom",
          message: `${key} wajib di production (adapter email Resend).`,
          path: [key],
        });
      }
    }
  }
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function parseServerEnvironment(
  environment: Record<string, string | undefined>,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= parseServerEnvironment(process.env);
  return cachedEnvironment;
}
