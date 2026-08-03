type PublicPageHeroProps = {
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  draft?: boolean;
};

export function PublicPageHero({
  index,
  eyebrow,
  title,
  description,
  draft = false,
}: PublicPageHeroProps) {
  return (
    <section className="page-hero">
      <div className="page-hero__index" aria-hidden="true">
        {index}
      </div>
      <div className="page-hero__copy">
        <p className="eyebrow">{eyebrow}</p>
        {draft ? <span className="draft-chip">Konten DRAFT</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}
