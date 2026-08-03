import Link from "next/link";
import { ShieldX } from "lucide-react";

export const dynamic = "force-dynamic";

export default function UnauthorizedPage() {
  return (
    <main className="auth-state-page" id="main-content">
      <div className="auth-state-page__code">403</div>
      <ShieldX aria-hidden="true" size={38} />
      <span className="auth-kicker">Policy server menolak request</span>
      <h1>Akses tidak diizinkan.</h1>
      <p>Role, permission, atau scope akun tidak memenuhi syarat untuk resource ini.</p>
      <div className="auth-state-page__actions">
        <Link href="/admin/dashboard">Kembali ke ruang kerja</Link>
        <Link href="/admin/login">Login dengan akun lain</Link>
      </div>
    </main>
  );
}

