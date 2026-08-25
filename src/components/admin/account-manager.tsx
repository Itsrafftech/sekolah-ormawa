"use client";

import { useState } from "react";
import { KeyRound, LoaderCircle, Power, RotateCcw, UserPlus } from "lucide-react";

import type { AccountListItem } from "@/features/admin/account-contracts";
import type { DepartmentOption } from "@/features/candidates/contracts";

type AccountManagerProps = {
  initialAccounts: AccountListItem[];
  departments: DepartmentOption[];
};

type PendingAction = { id: string; kind: "disable" | "reset" | "revoke" } | { id: "new" };

export function AccountManager({ initialAccounts, departments }: AccountManagerProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending({ id: "new" });
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, departmentId }),
      });
      const result = (await response.json()) as { data?: AccountListItem; error?: { message?: string } };
      if (!response.ok || !result.data) {
        setError(result.error?.message ?? "Akun tidak dapat dibuat.");
        return;
      }
      setAccounts((previous) => [...previous, result.data as AccountListItem]);
      setName("");
      setEmail("");
      setNotice(`Akun ${result.data.email} dibuat. Tautan setup dikirim lewat email outbox.`);
    } catch {
      setError("Akun tidak dapat dibuat. Periksa koneksi.");
    } finally {
      setPending(null);
    }
  }

  async function toggleDisabled(account: AccountListItem) {
    setPending({ id: account.id, kind: "disable" });
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/accounts/${account.id}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: !account.banned }),
      });
      const result = (await response.json()) as { data?: AccountListItem; error?: { message?: string } };
      if (!response.ok || !result.data) {
        setError(result.error?.message ?? "Status akun tidak dapat diubah.");
        return;
      }
      setAccounts((previous) => previous.map((item) => (item.id === account.id ? result.data as AccountListItem : item)));
    } catch {
      setError("Status akun tidak dapat diubah. Periksa koneksi.");
    } finally {
      setPending(null);
    }
  }

  async function issueReset(account: AccountListItem) {
    setPending({ id: account.id, kind: "reset" });
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/accounts/${account.id}/reset`, { method: "POST" });
      if (!response.ok) {
        setError("Tautan reset tidak dapat dikirim.");
        return;
      }
      setNotice(`Tautan reset baru untuk ${account.email} dikirim lewat email outbox.`);
    } catch {
      setError("Tautan reset tidak dapat dikirim. Periksa koneksi.");
    } finally {
      setPending(null);
    }
  }

  async function revokeSessions(account: AccountListItem) {
    setPending({ id: account.id, kind: "revoke" });
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/accounts/${account.id}/revoke`, { method: "POST" });
      if (!response.ok) {
        setError("Sesi tidak dapat dicabut.");
        return;
      }
      setNotice(`Seluruh sesi ${account.email} dicabut.`);
    } catch {
      setError("Sesi tidak dapat dicabut. Periksa koneksi.");
    } finally {
      setPending(null);
    }
  }

  function isPending(id: string, kind: "disable" | "reset" | "revoke"): boolean {
    return pending !== null && pending.id === id && "kind" in pending && pending.kind === kind;
  }

  return (
    <section className="account-manager" aria-labelledby="account-manager-title">
      <h2 id="account-manager-title">Akun PJ</h2>

      <form className="account-manager__form" onSubmit={createAccount}>
        <div>
          <label htmlFor="account-name">Nama</label>
          <input id="account-name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
        </div>
        <div>
          <label htmlFor="account-email">Email</label>
          <input id="account-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div>
          <label htmlFor="account-department">Birdep</label>
          <select id="account-department" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} required>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={pending?.id === "new"}>
          {pending?.id === "new" ? <LoaderCircle aria-hidden="true" className="spin" size={15} /> : <UserPlus aria-hidden="true" size={15} />}
          Buat akun PJ
        </button>
      </form>

      {error ? <p className="account-manager__error" role="alert">{error}</p> : null}
      {notice ? <p className="account-manager__notice" role="status">{notice}</p> : null}

      <ul className="account-manager__list">
        {accounts.map((account) => (
          <li key={account.id}>
            <div className="account-manager__row-main">
              <strong>{account.name}</strong>
              <span>{account.email}</span>
              <span className="account-manager__badges">
                <em>{account.role}</em>
                {account.departmentName ? <em>{account.departmentName}</em> : null}
                {account.banned ? <em data-tone="warning">Nonaktif</em> : null}
                {account.mustChangePassword ? <em data-tone="neutral">Belum setup</em> : null}
              </span>
            </div>
            {account.role === "DEPT_PJ" ? (
              <div className="account-manager__actions">
                <button type="button" disabled={isPending(account.id, "disable")} onClick={() => void toggleDisabled(account)}>
                  <Power aria-hidden="true" size={13} /> {account.banned ? "Aktifkan" : "Nonaktifkan"}
                </button>
                <button type="button" disabled={isPending(account.id, "reset")} onClick={() => void issueReset(account)}>
                  <KeyRound aria-hidden="true" size={13} /> Kirim reset
                </button>
                <button type="button" disabled={isPending(account.id, "revoke")} onClick={() => void revokeSessions(account)}>
                  <RotateCcw aria-hidden="true" size={13} /> Cabut sesi
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
