type PublicPageHeroProps = {
  index: string;
  eyebrow: string;
  title: string;
  description: string;
};

export function PublicPageHero({
  index,
  eyebrow,
  title,
  description,
}: PublicPageHeroProps) {
  return (
    <section className="page-hero">
      <div className="page-hero__index" aria-hidden="true">
        {index}
      </div>
      <div className="page-hero__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}
