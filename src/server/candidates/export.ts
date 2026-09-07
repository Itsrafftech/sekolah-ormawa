import "server-only";

import { toCsvRow } from "@/features/candidates/csv";
import { prisma } from "@/lib/db";

const CSV_HEADER = [
  "Nomor Registrasi",
  "Nama",
  "NIM",
  "Program Studi",
  "Kelas",
  "Telepon",
  "Email",
  "Domisili",
  "Pilihan",
  "Status",
  "Status Placement",
  "Waktu Daftar",
];

/**
 * CSV export scoped to one department (own for DEPT_PJ, chosen for
 * SUPER_ADMIN). Deliberately excludes object keys, signed URLs, and any
 * other file/storage reference - only candidate-facing fields already
 * visible on the dashboard are included (F7-03).
 */
export async function buildCandidateExportCsv(input: {
  departmentId: string;
  periodId: string;
}): Promise<string> {
  const candidates = await prisma.candidate.findMany({
    where: {
      periodId: input.periodId,
      deletedAt: null,
      status: { in: ["SUBMITTED", "LOCKED"] },
      choices: { some: { departmentId: input.departmentId } },
    },
    orderBy: { submittedAt: "asc" },
    select: {
      registrationNumber: true,
      name: true,
      nim: true,
      className: true,
      phone: true,
      email: true,
      domicile: true,
      status: true,
      submittedAt: true,
      studyProgram: true,
      choices: { where: { departmentId: input.departmentId }, select: { rank: true } },
      placement: { select: { status: true } },
    },
  });

  const lines = [toCsvRow(CSV_HEADER)];
  for (const candidate of candidates) {
    lines.push(toCsvRow([
      candidate.registrationNumber ?? "",
      candidate.name,
      candidate.nim,
      candidate.studyProgram,
      candidate.className,
      candidate.phone,
      candidate.email,
      candidate.domicile,
      candidate.choices[0]?.rank === "SECONDARY" ? "Pilihan kedua" : "Pilihan utama",
      candidate.status,
      candidate.placement?.status ?? "-",
      candidate.submittedAt.toISOString(),
    ]));
  }
  return lines.join("\r\n");
}
