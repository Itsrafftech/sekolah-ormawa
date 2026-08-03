import { ArrowUpRight, BriefcaseBusiness, Palette } from "lucide-react";

import type { PublicDepartment } from "@/lib/public/recruitment";

const unitTypeLabels = {
  BPH: "Badan Pengurus Harian",
  BIRO: "Biro",
  DEPARTEMEN: "Departemen",
} as const;

export function DepartmentGrid({
  departments,
  source,
  limit,
}: {
  departments: PublicDepartment[];
  source: "database" | "error";
  limit?: number;
}) {
  if (source === "error") {
    return (
      <div className="public-state public-state--error" role="status">
        <strong>Direktori belum dapat dimuat.</strong>
        <p>Koneksi data publik sedang tidak tersedia. Silakan coba kembali nanti.</p>
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="public-state" role="status">
        <strong>Belum ada profil unit yang dipublikasikan.</strong>
        <p>Master data akan muncul di sini setelah tersedia.</p>
      </div>
    );
  }

  return (
    <div className="department-grid">
      {departments.slice(0, limit).map((department, index) => (
        <article className="department-card" key={department.id}>
          <div className="department-card__topline">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span>{unitTypeLabels[department.unitType]}</span>
          </div>
          <div className="department-card__icon" aria-hidden="true">
            {department.requiresPortfolio ? <Palette size={24} /> : <BriefcaseBusiness size={24} />}
          </div>
          <p className="department-card__code">{department.code}</p>
          <h3>{department.name}</h3>
          <p className="department-card__description">
            {department.configStatus === "DRAFT"
              ? "Profil unit masih DRAFT dan menunggu deskripsi resmi pengurus."
              : department.description}
          </p>
          {department.requiresPortfolio ? (
            <p className="portfolio-note">Portofolio wajib bila Medbrand dipilih.</p>
          ) : null}
          <div className="department-card__status">
            <span
              className={department.acceptsApplications ? "slot-dot slot-dot--open" : "slot-dot"}
              aria-hidden="true"
            />
            {department.acceptsApplications
              ? "Membuka slot periode aktif"
              : "Profil unit · belum membuka slot"}
          </div>
          <ArrowUpRight className="department-card__arrow" aria-hidden="true" size={18} />
        </article>
      ))}
    </div>
  );
}
