const fallbackBadges = ["Small RNA", "Load Data", "Mapping Statistics"];

export default function WelcomePage({ hero }) {
  const badges = hero.badges?.length ? hero.badges : fallbackBadges;

  return (
    <div className="welcome-page">
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <div className="welcome-hero__grid">
          <div className="welcome-hero__copy">
            <p className="eyebrow eyebrow-light">
              {hero.eyebrow || "Small RNA Analysis"}
            </p>
            <h1 id="welcome-title">{hero.title || "sRNAmeta"}</h1>
            <p className="welcome-hero__lead">
              {hero.description ||
                "A focused interface for small RNA data loading, mapping statistics, and differential analysis."}
            </p>
            <p className="welcome-hero__supporting">
              {hero.supporting ||
                "Load data first, then move through mapping statistics and differential analysis with a consistent workflow."}
            </p>
            <div className="welcome-badges" aria-label="Analysis highlights">
              {badges.map((item) => (
                <span className="welcome-badge" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>

          {hero.logoSrc ? (
            <div className="welcome-hero__media">
              <img
                className="welcome-hero__logo"
                src={hero.logoSrc}
                alt="sRNAmeta logo"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
