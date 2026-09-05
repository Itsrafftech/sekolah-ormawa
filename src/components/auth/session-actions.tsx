"use client";

import { useState } from "react";
import { LogOut, RotateCcw } from "lucide-react";

export function SessionActions() {
  const [loading, setLoading] = useState<"logout" | "revoke" | null>(null);

  async function act(kind: "logout" | "revoke") {
    setLoading(kind);
    try {
      const endpoint = kind === "logout" ? "/api/admin/auth/logout" : "/api/admin/auth/revoke-all";
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await response.json() as { data?: { next?: string } };
      // Hard navigation - see login-form.tsx's identical comment. Logout
      // is the other half of the same identity-boundary bug: without it,
      // a page from the session that just ended can stay in the Router
      // Cache and get served (with its stale departmentId) to whoever
      // logs into this tab next.
      window.location.href = result.data?.next ?? "/admin/login?reason=session-expired";
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="session-actions">
      <button disabled={loading !== null} type="button" onClick={() => act("logout")}>
        <LogOut aria-hidden="true" size={17} />
        {loading === "logout" ? "Keluar..." : "Logout sesi ini"}
      </button>
      <button disabled={loading !== null} type="button" onClick={() => act("revoke")}>
        <RotateCcw aria-hidden="true" size={17} />
        {loading === "revoke" ? "Mencabut..." : "Cabut semua sesi"}
      </button>
    </div>
  );
}

