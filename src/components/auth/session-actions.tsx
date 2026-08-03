"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, RotateCcw } from "lucide-react";

export function SessionActions() {
  const router = useRouter();
  const [loading, setLoading] = useState<"logout" | "revoke" | null>(null);

  async function act(kind: "logout" | "revoke") {
    setLoading(kind);
    try {
      const endpoint = kind === "logout" ? "/api/admin/auth/logout" : "/api/admin/auth/revoke-all";
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await response.json() as { data?: { next?: string } };
      router.replace(result.data?.next ?? "/admin/login?reason=session-expired");
      router.refresh();
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

