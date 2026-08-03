import { describe, expect, it } from "vitest";

import {
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";

describe("Argon2id password adapter", () => {
  it("menghasilkan PHC string Argon2id dan memverifikasi password", async () => {
    const password = "Fixture-Password-63!";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    await expect(
      verifyPassword({ password, hash: passwordHash }),
    ).resolves.toBe(true);
    await expect(
      verifyPassword({ password: "salah", hash: passwordHash }),
    ).resolves.toBe(false);
  });

  it("menggunakan salt acak untuk password yang sama", async () => {
    const password = "Fixture-Password-63!";
    const [first, second] = await Promise.all([
      hashPassword(password),
      hashPassword(password),
    ]);

    expect(first).not.toBe(second);
  });
});
