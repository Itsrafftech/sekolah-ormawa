import { ArrowUpRight, BriefcaseBusiness, Palette } from "lucide-react";

import type { PublicDepartment } from "@/lib/public/recruitment";

// unitType is a shared DB enum (BPH/BIRO/DEPARTEMEN), but BPH never appears
// on the public directory (the data layer filters it out), and the two
// branches call their remaining units by different names: the executive
// branch calls them Biro/Departemen, the legislative branch calls the
// same-shaped rows Badan/Komisi (see the department's own `name`, e.g.
// "Badan Media dan Branding" or "Komisi Legislasi" - both stored with
// unitType BIRO/DEPARTEMEN respectively). Read the badge off track so it
// matches the guidebook's terminology instead of the raw enum label.
function unitTypeLabel(department: PublicDepartment): string {
  if (department.track === "LEGISLATIVE") {
    return department.unitType === "BIRO" ? "Badan" : "Komisi";
  }
  return department.unitType === "BIRO" ? "Biro" : "Departemen";
}

// Each Birdep's public profile lives on its branch's own site, not this
// app. The executive branch (Biro/Departemen) has one page per unit
// under ormawaeksekutifpku.com/struktur-organisasi/. The legislative
// branch (Komisi/Badan) instead publishes a single page on legislatifpku.com
// with one #anchor per unit. Both use the department's shortName,
// lowercased, as their slug.
function departmentExternalHref(department: PublicDepartment): string {
  const slug = department.shortName.toLowerCase();
  return department.track === "LEGISLATIVE"
    ? `https://legislatifpku.com/tentang-ormawa-ipb-legislatif-pku#${slug}`
    : `https://ormawaeksekutifpku.com/struktur-organisasi/${slug}`;
}

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
        <a
          aria-label={`${department.name} - profil lengkap di situs ${department.track === "LEGISLATIVE" ? "Legislatif PKU" : "Eksekutif PKU"} (tautan eksternal, tab baru)`}
          className="department-card"
          href={departmentExternalHref(department)}
          key={department.id}
          rel="noopener noreferrer"
          target="_blank"
        >
          <div className="department-card__topline">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span>{unitTypeLabel(department)}</span>
          </div>
          <div className="department-card__icon" aria-hidden="true">
            {department.requiresPortfolio ? <Palette size={24} /> : <BriefcaseBusiness size={24} />}
          </div>
          <p className="department-card__code">{department.code}</p>
          <h3>{department.name}</h3>
          {department.configStatus === "DRAFT" ? (
            <p className="department-card__cta">Kenali unit ini →</p>
          ) : (
            <p className="department-card__description">{department.description}</p>
          )}
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
        </a>
      ))}
    </div>
  );
}
