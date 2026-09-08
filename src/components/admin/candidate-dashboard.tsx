"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Lock, Search, Users } from "lucide-react";

import type {
  CandidateListItem,
  CandidateSegment,
  CandidateSelectionInfo,
  DepartmentOption,
} from "@/features/candidates/contracts";
import { SELECTION_STATUS_LABEL, SELECTION_STATUS_TONE, type SelectionStatusTone } from "@/features/candidates/selection-status-labels";
import { StatusPill } from "@/components/ui/status-pill";

type SegmentCounts = Record<CandidateSegment, number>;

/**
 * Badge shown on a dashboard row for the viewer's own selection role. P1
 * only needs the one explicit cross-side flag the spec calls out (P2 also
 * ragu-ragu); P2 gets the visibility-matrix badges spelled out in the
 * product spec (PENDING/TAKEN carry none - PENDING is a no-op, TAKEN never
 * reaches P2's list because segmentWhere already excludes it).
 */
function selectionBadge(selection: CandidateSelectionInfo | null): { label: string; tone: SelectionStatusTone } | null {
  if (!selection || selection.status === "PENDING") return null;
  if (selection.role === "P2" && selection.status === "HESITANT_P1") {
    return { label: "PJ Pilihan 1 ragu-ragu", tone: "warning" };
  }
  if (selection.role === "P1" && selection.status === "HESITANT_P2") {
    return { label: "PJ Pilihan 2 ragu-ragu", tone: "warning" };
  }
  if (selection.role === "P1" && selection.status !== "TAKEN") {
    // Everything else on P1's own side besides their own TAKEN (which is
    // implicit - they're the one looking at it) is worth a quiet reminder.
    return { label: SELECTION_STATUS_LABEL[selection.status], tone: SELECTION_STATUS_TONE[selection.status] };
  }
  if (selection.role === "P2") {
    return { label: SELECTION_STATUS_LABEL[selection.status], tone: SELECTION_STATUS_TONE[selection.status] };
  }
  return null;
}

type CandidateDashboardProps = {
  // "Tambah Role Baru dan 2 Akun": KETUA_PELAKSANA dapat department
  // switcher seperti SUPER_ADMIN (read-only) - lihat detailHref/switcher
  // di bawah, keduanya dicek lewat `role !== "DEPT_PJ"`.
  role: "SUPER_ADMIN" | "DEPT_PJ" | "KETUA_PELAKSANA";
  departmentId: string;
  departments: DepartmentOption[];
  periodName: string | null;
  initialItems: CandidateListItem[];
  initialCounts: SegmentCounts;
  initialNextCursor: string | null;
};

const SEGMENT_LABEL: Record<CandidateSegment, string> = {
  PRIMARY: "Pilihan utama",
  SECONDARY: "Pilihan kedua",
  LOCKED: "Diterima Birdep ini",
};

type ListResponse = {
  data: {
    items: CandidateListItem[];
    nextCursor: string | null;
    counts: SegmentCounts;
  } | null;
  error: { message: string } | null;
};

export function CandidateDashboard({
  role,
  departmentId: initialDepartmentId,
  departments,
  periodName,
  initialItems,
  initialCounts,
  initialNextCursor,
}: CandidateDashboardProps) {
  const [departmentId, setDepartmentId] = useState(initialDepartmentId);
  const [segment, setSegment] = useState<CandidateSegment>("PRIMARY");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CandidateListItem[]>(initialItems);
  const [counts, setCounts] = useState<SegmentCounts>(initialCounts);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestToken = useRef(0);

  const fetchList = useCallback(
    async (options: { cursor?: string | null; append?: boolean }) => {
      const token = ++requestToken.current;
      if (options.append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const params = new URLSearchParams({ segment, departmentId });
        if (search) params.set("search", search);
        if (options.cursor) params.set("cursor", options.cursor);
        const response = await fetch(`/api/admin/candidates?${params.toString()}`, {
          headers: { Accept: "application/json" },
        });
        const result = (await response.json()) as ListResponse;
        if (token !== requestToken.current) return;
        if (!response.ok || !result.data) {
          setError(result.error?.message ?? "Data kandidat tidak dapat dimuat.");
          return;
        }
        setCounts(result.data.counts);
        setNextCursor(result.data.nextCursor);
        setItems((previous) =>
          options.append ? [...previous, ...result.data!.items] : result.data!.items,
        );
      } catch {
        if (token === requestToken.current) {
          setError("Data kandidat tidak dapat dimuat. Periksa koneksi.");
        }
      } finally {
        if (token === requestToken.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [segment, departmentId, search],
  );

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void fetchList({});
  }, [segment, departmentId, search, fetchList]);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const detailHref = useMemo(
    () => (id: string) =>
      role !== "DEPT_PJ"
        ? `/admin/dashboard/kandidat/${id}?departmentId=${departmentId}`
        : `/admin/dashboard/kandidat/${id}`,
    [role, departmentId],
  );

  return (
    <section className="candidate-dashboard" aria-labelledby="candidate-dashboard-title">
      <div className="candidate-dashboard__heading">
        <div>
          <span className="auth-kicker">Dashboard PJ / Phase 5</span>
          <h2 id="candidate-dashboard-title">
            <Users aria-hidden="true" size={22} /> Kandidat {periodName ?? "-- periode belum tersedia --"}
          </h2>
        </div>
        <div className="candidate-dashboard__heading-actions">
          {role !== "DEPT_PJ" && departments.length > 0 ? (
            <label className="candidate-dashboard__dept-switch">
              <span>Birdep</span>
              <select
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.shortName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <a
            className="candidate-dashboard__export"
            href={`/api/admin/candidates/export?departmentId=${departmentId}`}
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="candidate-dashboard__tabs" role="tablist" aria-label="Segmen kandidat">
        {(["PRIMARY", "SECONDARY", "LOCKED"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={segment === value}
            className="candidate-dashboard__tab"
            data-active={segment === value}
            onClick={() => setSegment(value)}
          >
            {value === "LOCKED" ? <Lock aria-hidden="true" size={13} /> : null}
            {SEGMENT_LABEL[value]}
            <span>{counts[value]}</span>
          </button>
        ))}
      </div>

      <div className="candidate-dashboard__search">
        <Search aria-hidden="true" size={16} />
        <input
          type="search"
          placeholder="Cari nama, NIM, email, atau nomor registrasi"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Cari kandidat"
        />
      </div>

      {error ? <p className="candidate-dashboard__error" role="alert">{error}</p> : null}

      {loading ? (
        <p className="candidate-dashboard__loading"><LoaderCircle aria-hidden="true" className="spin" size={18} /> Memuat kandidat...</p>
      ) : items.length === 0 ? (
        <p className="candidate-dashboard__empty">Tidak ada kandidat pada segmen ini.</p>
      ) : (
        <ul className="candidate-dashboard__list">
          {items.map((item) => {
            const badge = selectionBadge(item.selection);
            return (
              <li key={item.id}>
                <Link href={detailHref(item.id)} className="candidate-dashboard__row">
                  <span className="candidate-dashboard__row-name">{item.name}</span>
                  <span className="candidate-dashboard__row-meta">
                    {item.nim} &middot; {item.studyProgramName}
                  </span>
                  <span className="candidate-dashboard__row-end">
                    {badge ? <StatusPill tone={badge.tone}>{badge.label}</StatusPill> : null}
                    <span className="candidate-dashboard__row-reg">{item.registrationNumber ?? "--"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor && !loading ? (
        <button
          type="button"
          className="candidate-dashboard__more"
          disabled={loadingMore}
          onClick={() => void fetchList({ cursor: nextCursor, append: true })}
        >
          {loadingMore ? "Memuat..." : "Muat lebih banyak"}
        </button>
      ) : null}
    </section>
  );
}
