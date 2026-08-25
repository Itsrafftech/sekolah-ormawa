"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import {
  CONFIG_STATUS_VALUES,
  PERIOD_STATUS_VALUES,
  type PeriodDepartmentItem,
  type PeriodListItem,
} from "@/features/admin/period-contracts";

type PeriodManagerProps = {
  initialPeriods: PeriodListItem[];
};

function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 16);
}

export function PeriodManager({ initialPeriods }: PeriodManagerProps) {
  const [periods, setPeriods] = useState(initialPeriods);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<PeriodDepartmentItem[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function toggleExpand(period: PeriodListItem) {
    if (expandedId === period.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(period.id);
    setError(null);
    const response = await fetch(`/api/admin/periods/${period.id}/departments`);
    const result = (await response.json()) as { data?: { departments: PeriodDepartmentItem[] } };
    setDepartments(result.data?.departments ?? []);
  }

  async function savePeriod(period: PeriodListItem, form: HTMLFormElement) {
    setPending(period.id);
    setError(null);
    setNotice(null);
    const data = new FormData(form);
    const payload = {
      status: String(data.get("status")),
      configStatus: String(data.get("configStatus")),
      entryYear: data.get("entryYear") ? Number(data.get("entryYear")) : null,
      registrationPrefix: data.get("registrationPrefix") ? String(data.get("registrationPrefix")) : null,
      consentVersion: data.get("consentVersion") ? String(data.get("consentVersion")) : null,
      opensAt: data.get("opensAt") ? new Date(String(data.get("opensAt"))).toISOString() : null,
      closesAt: data.get("closesAt") ? new Date(String(data.get("closesAt"))).toISOString() : null,
      choice2Required: data.get("choice2Required") === "on",
      allowUnlock: data.get("allowUnlock") === "on",
    };
    try {
      const response = await fetch(`/api/admin/periods/${period.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { data?: PeriodListItem; error?: { message?: string } };
      if (!response.ok || !result.data) {
        setError(result.error?.message ?? "Periode tidak dapat disimpan.");
        return;
      }
      setPeriods((previous) => previous.map((item) => (item.id === period.id ? result.data as PeriodListItem : item)));
      setNotice(`Periode ${result.data.name} disimpan.`);
    } catch {
      setError("Periode tidak dapat disimpan. Periksa koneksi.");
    } finally {
      setPending(null);
    }
  }

  async function saveDepartment(periodId: string, department: PeriodDepartmentItem, form: HTMLFormElement) {
    setPending(`${periodId}:${department.departmentId}`);
    setError(null);
    const data = new FormData(form);
    const payload = {
      acceptsApplications: data.get("acceptsApplications") === "on",
      quota: data.get("quota") ? Number(data.get("quota")) : null,
    };
    try {
      const response = await fetch(`/api/admin/periods/${periodId}/departments/${department.departmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { data?: PeriodDepartmentItem; error?: { message?: string } };
      if (!response.ok || !result.data) {
        setError(result.error?.message ?? "Konfigurasi Birdep tidak dapat disimpan.");
        return;
      }
      setDepartments((previous) => previous.map((item) => (item.departmentId === department.departmentId ? result.data as PeriodDepartmentItem : item)));
    } catch {
      setError("Konfigurasi Birdep tidak dapat disimpan. Periksa koneksi.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="period-manager" aria-labelledby="period-manager-title">
      <h2 id="period-manager-title">Periode Rekrutmen</h2>
      {error ? <p className="account-manager__error" role="alert">{error}</p> : null}
      {notice ? <p className="account-manager__notice" role="status">{notice}</p> : null}

      <ul className="period-manager__list">
        {periods.map((period) => (
          <li key={period.id}>
            <button type="button" className="period-manager__summary" onClick={() => void toggleExpand(period)}>
              <span>{period.name}</span>
              <span>{period.code}</span>
              <span>{period.status}</span>
              <span>{period.candidateCount} kandidat</span>
            </button>

            {expandedId === period.id ? (
              <div className="period-manager__detail">
                <form
                  onSubmit={(event) => { event.preventDefault(); void savePeriod(period, event.currentTarget); }}
                >
                  <div className="period-manager__grid">
                    <label>Status
                      <select name="status" defaultValue={period.status}>
                        {PERIOD_STATUS_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </label>
                    <label>Config status
                      <select name="configStatus" defaultValue={period.configStatus}>
                        {CONFIG_STATUS_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </label>
                    <label>Tahun masuk
                      <input type="number" name="entryYear" defaultValue={period.entryYear ?? ""} min={1900} max={2200} />
                    </label>
                    <label>Prefix registrasi
                      <input type="text" name="registrationPrefix" defaultValue={period.registrationPrefix ?? ""} maxLength={20} />
                    </label>
                    <label>Versi consent
                      <input type="text" name="consentVersion" defaultValue={period.consentVersion ?? ""} maxLength={100} />
                    </label>
                    <label>Buka pada
                      <input type="datetime-local" name="opensAt" defaultValue={toDatetimeLocal(period.opensAt)} />
                    </label>
                    <label>Tutup pada
                      <input type="datetime-local" name="closesAt" defaultValue={toDatetimeLocal(period.closesAt)} />
                    </label>
                    <label className="period-manager__checkbox">
                      <input type="checkbox" name="choice2Required" defaultChecked={period.choice2Required} /> Pilihan kedua wajib
                    </label>
                    <label className="period-manager__checkbox">
                      <input type="checkbox" name="allowUnlock" defaultChecked={period.allowUnlock} /> Izinkan unlock
                    </label>
                  </div>
                  <button type="submit" disabled={pending === period.id}>
                    {pending === period.id ? <LoaderCircle aria-hidden="true" className="spin" size={14} /> : null}
                    Simpan periode
                  </button>
                </form>

                <h3>Ketersediaan per Birdep</h3>
                <ul className="period-manager__departments">
                  {departments.map((department) => (
                    <li key={department.departmentId}>
                      <form
                        onSubmit={(event) => { event.preventDefault(); void saveDepartment(period.id, department, event.currentTarget); }}
                      >
                        <span>{department.departmentName}</span>
                        <label className="period-manager__checkbox">
                          <input type="checkbox" name="acceptsApplications" defaultChecked={department.acceptsApplications} /> Menerima
                        </label>
                        <label>Kuota
                          <input type="number" name="quota" defaultValue={department.quota ?? ""} min={0} max={10000} />
                        </label>
                        <button type="submit" disabled={pending === `${period.id}:${department.departmentId}`}>Simpan</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
