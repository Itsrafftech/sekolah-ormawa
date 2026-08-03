import { describe, expect, it } from "vitest";

import { parseServerEnvironment } from "@/lib/env";

const validEnvironment = {
  NODE_ENV: "test",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://fixture:fixture@localhost:55432/fixture",
  AUTH_SECRET: "fixture-secret-with-at-least-thirty-two-characters",
  IP_HASH_SECRET: "fixture-ip-hash-secret-value",
};

describe("server environment", () => {
  it("menggunakan default development yang aman dan dapat dikonfigurasi", () => {
    const environment = parseServerEnvironment(validEnvironment);

    expect(environment.SESSION_MAX_AGE_SECONDS).toBe(900);
    expect(environment.SESSION_UPDATE_AGE_SECONDS).toBe(300);
    expect(environment.SESSION_IDLE_TIMEOUT_SECONDS).toBe(900);
    expect(environment.LOGIN_RATE_LIMIT_MAX_ATTEMPTS).toBe(5);
    expect(environment.REGISTRATION_SUBMISSION_ENABLED).toBe(false);
    expect(environment.PORTFOLIO_MAX_FILES).toBe(5);
  });

  it("menolak auth secret yang terlalu pendek", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        AUTH_SECRET: "terlalu-pendek",
      }),
    ).toThrow();
  });
});
