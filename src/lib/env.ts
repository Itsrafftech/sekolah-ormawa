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
  EMAIL_SINK_ROOT: z.string().min(1).default("email-sink"),
  EMAIL_OUTBOX_MAX_ATTEMPTS: numberFromEnvironment(5),
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
