import { clsx } from "clsx";

type StatusPillProps = {
  children: React.ReactNode;
  tone?: "neutral" | "ready" | "warning" | "success" | "danger";
};

export function StatusPill({
  children,
  tone = "neutral",
}: StatusPillProps) {
  return (
    <span
      className={clsx("status-pill", {
        "status-pill--ready": tone === "ready" || tone === "success",
        "status-pill--warning": tone === "warning",
        "status-pill--danger": tone === "danger",
      })}
    >
      <span aria-hidden="true" className="status-pill__dot" />
      {children}
    </span>
  );
}
