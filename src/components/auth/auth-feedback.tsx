import type { RefObject } from "react";

export function AuthFeedback({
  message,
  tone = "error",
  feedbackRef,
}: {
  message: string | null;
  tone?: "error" | "success" | "notice";
  feedbackRef?: RefObject<HTMLDivElement | null>;
}) {
  if (!message) return null;
  return (
    <div
      className={`auth-feedback auth-feedback--${tone}`}
      ref={feedbackRef}
      role={tone === "error" ? "alert" : "status"}
      tabIndex={-1}
    >
      <strong>{tone === "error" ? "Periksa kembali." : tone === "success" ? "Permintaan diterima." : "Informasi sesi."}</strong>
      <p>{message}</p>
    </div>
  );
}

