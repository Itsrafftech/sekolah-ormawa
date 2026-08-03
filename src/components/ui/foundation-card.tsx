import type { LucideIcon } from "lucide-react";

type FoundationCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export function FoundationCard({
  eyebrow,
  title,
  description,
  icon: Icon,
}: FoundationCardProps) {
  return (
    <article className="foundation-card">
      <div className="foundation-card__icon" aria-hidden="true">
        <Icon size={21} strokeWidth={1.7} />
      </div>
      <p className="foundation-card__eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </article>
  );
}
