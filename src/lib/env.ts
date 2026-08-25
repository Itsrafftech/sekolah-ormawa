import { z } from "zod";

const numberFromEnvironment = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);

const serverEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
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
  PORTFOLIO_MAX_FILES: numberFromEnvironment(5),
  PORTFOLIO_MAX_FILE_BYTES: numberFromEnvironment(5242880),
  PORTFOLIO_URL_MAX_LENGTH: numberFromEnvironment(2048),
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
