import type { ConfigStatus, PeriodStatus } from "@/generated/prisma/client";

export type RegistrationState = "OPEN" | "UPCOMING" | "CLOSED" | "UNAVAILABLE";

export type PublicPeriodState = {
  name: string;
  status: PeriodStatus;
  configStatus: ConfigStatus;
  cohortCode: number;
  opensAt: Date | null;
  closesAt: Date | null;
};

export type PublicRegistration = {
  state: RegistrationState;
  label: string;
  detail: string;
  href: string | null;
  periodName: string | null;
};

export function resolveRegistrationState(
  period: PublicPeriodState | null,
  now = new Date(),
): PublicRegistration {
  if (!period) {
    return {
      state: "UNAVAILABLE",
      label: "Jadwal belum diumumkan",
      detail: "Belum ada periode publik yang dapat ditampilkan.",
      href: null,
      periodName: null,
    };
  }

  if (period.configStatus !== "ACTIVE" || period.status === "DRAFT") {
    return {
      state: "UPCOMING",
      label: "Pendaftaran belum dibuka",
      detail: "Konfigurasi periode masih berstatus DRAFT.",
      href: null,
      periodName: period.name,
    };
  }

  if (
    period.status === "CLOSED" ||
    period.status === "ARCHIVED" ||
    (period.closesAt !== null && now >= period.closesAt)
  ) {
    return {
      state: "CLOSED",
      label: "Pendaftaran ditutup",
      detail: "Periode ini sudah tidak menerima pendaftaran.",
      href: null,
      periodName: period.name,
    };
  }

  if (
    period.status !== "OPEN" ||
    (period.opensAt !== null && now < period.opensAt)
  ) {
    return {
      state: "UPCOMING",
      label: "Pendaftaran belum dibuka",
      detail: "Periode telah disiapkan, tetapi waktu pendaftaran belum dimulai.",
      href: null,
      periodName: period.name,
    };
  }

  return {
    state: "OPEN",
    label: "Daftar Sekarang",
    detail: "Periode pendaftaran sedang dibuka.",
    href: "/daftar",
    periodName: period.name,
  };
}
