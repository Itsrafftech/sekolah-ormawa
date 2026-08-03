import { z } from "zod";

export const GENERIC_LOGIN_ERROR = "Email atau password tidak valid.";
export const GENERIC_RESET_REQUEST_MESSAGE =
  "Jika akun terdaftar dan aktif, instruksi reset akan tersedia melalui kanal development.";

export const emailInputSchema = z.string().trim().toLowerCase().email().max(254);

export function normalizeAdminEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validatePasswordPolicy(
  password: string,
  maximumLength: number,
): string | null {
  if (password.length < 12) return "Password minimal 12 karakter.";
  if (password.length > maximumLength) {
    return `Password maksimal ${maximumLength} karakter dan tidak dipotong.`;
  }
  return null;
}

export function sanitizeAdminRedirect(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin/dashboard";
  }
  try {
    const parsed = new URL(value, "https://sekolah.invalid");
    if (parsed.origin !== "https://sekolah.invalid" || !parsed.pathname.startsWith("/admin/")) {
      return "/admin/dashboard";
    }
    if (["/admin/login", "/admin/lupa-password", "/admin/reset-password"].includes(parsed.pathname)) {
      return "/admin/dashboard";
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/admin/dashboard";
  }
}

