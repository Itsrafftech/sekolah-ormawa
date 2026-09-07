import { clsx } from "clsx";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "split";
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "split",
}: SectionHeadingProps) {
  return (
    <header className={clsx("section-heading", `section-heading--${align}`)}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
      </div>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
    </header>
  );
}
