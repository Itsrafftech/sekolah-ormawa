import { clsx } from "clsx";

type StatusPillProps = {
  children: React.ReactNode;
  tone?: "neutral" | "ready" | "warning";
};

export function StatusPill({
  children,
  tone = "neutral",
}: StatusPillProps) {
  return (
    <span
      className={clsx("status-pill", {
        "status-pill--ready": tone === "ready",
        "status-pill--warning": tone === "warning",
      })}
    >
      <span aria-hidden="true" className="status-pill__dot" />
      {children}
    </span>
  );
}
