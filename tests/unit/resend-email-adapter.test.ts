import { beforeEach, describe, expect, it, vi } from "vitest";

// @/server/email/outbox also exports processEmailOutbox/claimOutbox, which
// import @/lib/db - and that module reads getServerEnvironment() eagerly at
// import time. This unit test never touches the database, but the module
// graph still needs these to satisfy zod validation before it can load; set
// harmless placeholder values (not real credentials) before the dynamic
// import() below.
process.env.DATABASE_URL ??= "postgresql://unit-test:unused@localhost:5432/unit_test";
process.env.AUTH_SECRET ??= "unit-test-only-auth-secret-not-a-real-secret-value";
process.env.IP_HASH_SECRET ??= "unit-test-only-ip-hash-secret";

// Phase 9: unit tests for ResendEmailAdapter with the `resend` SDK mocked -
// no real network call. Verifies each EmailPayload kind renders sensible
// subject/html/text, the idempotency key is forwarded to Resend's own
// idempotency support, and provider-reported errors surface as thrown
// errors (so the outbox's retry/backoff logic - already tested in
// tests/integration/*.test.ts - kicks in exactly as it does for a network
// failure).
const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: sendMock };
  },
}));

async function loadAdapter() {
  return import("@/server/email/outbox");
}

describe("ResendEmailAdapter", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });
  });

  it("melempar error jelas jika RESEND_API_KEY atau RESEND_FROM_EMAIL tidak ada", async () => {
    const { ResendEmailAdapter } = await loadAdapter();
    expect(() => new ResendEmailAdapter({
      RESEND_API_KEY: undefined,
      RESEND_FROM_EMAIL: undefined,
    } as unknown as ConstructorParameters<typeof ResendEmailAdapter>[0])).toThrow(/RESEND_API_KEY/);
  });

  it("mengirim REGISTRATION_CONFIRMATION dengan subjek dan isi yang memuat nomor registrasi", async () => {
    const { ResendEmailAdapter } = await loadAdapter();
    const adapter = new ResendEmailAdapter({
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM_EMAIL: "noreply@example.test",
    } as unknown as ConstructorParameters<typeof ResendEmailAdapter>[0]);

    await adapter.send({
      kind: "REGISTRATION_CONFIRMATION",
      recipient: "peserta@example.test",
      participantName: "Peserta Sintetis",
      registrationNumber: "SO63-0001",
      submittedAt: "2026-08-12T00:00:00.000Z",
      choices: ["Birdep A", "Birdep B"],
    }, "idem-key-1");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload, options] = sendMock.mock.calls[0] as [Record<string, string>, Record<string, string>];
    expect(payload.from).toBe("noreply@example.test");
    expect(payload.to).toBe("peserta@example.test");
    expect(payload.subject).toContain("SO63-0001");
    expect(payload.html).toContain("SO63-0001");
    expect(payload.html).toContain("Birdep A");
    expect(payload.text).toContain("SO63-0001");
    expect(options.idempotencyKey).toBe("idem-key-1");
  });

  it("mengirim PASSWORD_RESET dengan link reset di html dan text", async () => {
    const { ResendEmailAdapter } = await loadAdapter();
    const adapter = new ResendEmailAdapter({
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM_EMAIL: "noreply@example.test",
    } as unknown as ConstructorParameters<typeof ResendEmailAdapter>[0]);

    await adapter.send({
      kind: "PASSWORD_RESET",
      recipient: "admin@example.test",
      recipientName: "Admin Sintetis",
      resetUrl: "https://sekolah.ormawaeksekutifpku.com/admin/reset-password?token=abc",
      expiresAt: "2026-08-12T01:00:00.000Z",
    }, "idem-key-2");

    const [payload] = sendMock.mock.calls[0] as [Record<string, string>];
    expect(payload.subject.toLowerCase()).toContain("reset password");
    expect(payload.html).toContain("token=abc");
    expect(payload.text).toContain("token=abc");
  });

  it("mengirim ACCOUNT_SETUP dengan link setup", async () => {
    const { ResendEmailAdapter } = await loadAdapter();
    const adapter = new ResendEmailAdapter({
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM_EMAIL: "noreply@example.test",
    } as unknown as ConstructorParameters<typeof ResendEmailAdapter>[0]);

    await adapter.send({
      kind: "ACCOUNT_SETUP",
      recipient: "pj@example.test",
      recipientName: "PJ Sintetis",
      setupUrl: "https://sekolah.ormawaeksekutifpku.com/admin/reset-password?token=setup",
      expiresAt: "2026-08-12T01:00:00.000Z",
    }, "idem-key-3");

    const [payload] = sendMock.mock.calls[0] as [Record<string, string>];
    expect(payload.subject.toLowerCase()).toContain("aktivasi");
    expect(payload.html).toContain("token=setup");
  });

  it("mengirim BROADCAST dengan subjek dan body persis seperti konten yang diminta", async () => {
    const { ResendEmailAdapter } = await loadAdapter();
    const adapter = new ResendEmailAdapter({
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM_EMAIL: "noreply@example.test",
    } as unknown as ConstructorParameters<typeof ResendEmailAdapter>[0]);

    await adapter.send({
      kind: "BROADCAST",
      recipient: "peserta@example.test",
      recipientName: "Peserta Sintetis",
      subject: "Pengumuman penting",
      body: "Baris pertama.\nBaris kedua.",
    }, "idem-key-4");

    const [payload] = sendMock.mock.calls[0] as [Record<string, string>];
    expect(payload.subject).toBe("Pengumuman penting");
    expect(payload.html).toContain("Baris pertama.");
    expect(payload.html).toContain("<br/>");
    expect(payload.text).toContain("Baris pertama.\nBaris kedua.");
  });

  it("melempar error saat Resend mengembalikan error", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "Domain not verified", name: "validation_error" } });
    const { ResendEmailAdapter } = await loadAdapter();
    const adapter = new ResendEmailAdapter({
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM_EMAIL: "noreply@example.test",
    } as unknown as ConstructorParameters<typeof ResendEmailAdapter>[0]);

    await expect(adapter.send({
      kind: "BROADCAST",
      recipient: "peserta@example.test",
      recipientName: "Peserta Sintetis",
      subject: "x",
      body: "y",
    }, "idem-key-5")).rejects.toThrow(/Domain not verified/);
  });

  it("getEmailAdapter mengembalikan LocalEmailSinkAdapter di luar production", async () => {
    const { getEmailAdapter, LocalEmailSinkAdapter } = await loadAdapter();
    expect(getEmailAdapter()).toBeInstanceOf(LocalEmailSinkAdapter);
  });
});
