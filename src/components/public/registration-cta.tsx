import Link from "next/link";
import { ArrowRight, Clock3, LockKeyhole } from "lucide-react";

import type { PublicRegistration } from "@/lib/public/registration-state";

export function RegistrationCta({
  registration,
  compact = false,
}: {
  registration: PublicRegistration;
  compact?: boolean;
}) {
  const registrationHref =
    registration.state === "OPEN" ? registration.href : null;

  return (
    <div
      className={compact ? "registration-cta registration-cta--compact" : "registration-cta"}
      data-registration-state={registration.state}
      id={compact ? undefined : "pendaftaran"}
    >
      <div className="registration-cta__status">
        <span className={`registration-dot registration-dot--${registration.state.toLowerCase()}`} />
        {/* Compact mode (hero) sits the button right underneath this row,
            and the button's own text already repeats registration.label -
            visually it read as the same sentence printed twice. Keep it
            for screen readers (the dot alone carries no meaning) but stop
            showing it twice to sighted users. */}
        <span className={compact ? "sr-only" : undefined}>{registration.label}</span>
      </div>
      {!compact ? (
        <div className="registration-cta__copy">
          <p>{registration.detail}</p>
          {registration.periodName ? <small>{registration.periodName}</small> : null}
        </div>
      ) : null}
      {registrationHref ? (
        <Link className="button button--primary" href={registrationHref}>
          Daftar Sekarang <ArrowRight aria-hidden="true" size={17} />
        </Link>
      ) : (
        <span className="button button--disabled" aria-disabled="true">
          {registration.state === "CLOSED" ? (
            <LockKeyhole aria-hidden="true" size={16} />
          ) : (
            <Clock3 aria-hidden="true" size={16} />
          )}
          {registration.label}
        </span>
      )}
    </div>
  );
}
