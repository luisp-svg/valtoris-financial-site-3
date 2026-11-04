export default function PremiumAudience({ locale }: { locale: "en" | "es" }) {
  const es = locale === "es";
  const cards = es
    ? [
        [
          "01",
          "Dueños de negocios",
          "Protege la empresa que has creado. Coordina continuidad, beneficios y decisiones personales con una perspectiva más amplia.",
        ],
        [
          "02",
          "Profesionales consolidados",
          "Da estructura a decisiones que se vuelven más complejas a medida que crecen tu carrera, ingresos y responsabilidades.",
        ],
        [
          "03",
          "Familias establecidas",
          "Conecta protección, jubilación y legado alrededor de las personas y el futuro que más importan.",
        ],
      ]
    : [
        [
          "01",
          "Business Owners",
          "Protect the enterprise you’ve built. Bring continuity, employee benefits, and personal planning into one coordinated conversation.",
        ],
        [
          "02",
          "Accomplished Professionals",
          "Bring structure to the decisions that grow more complex as your career, income, and responsibilities expand.",
        ],
        [
          "03",
          "Established Families",
          "Connect protection, retirement, and legacy around the people and future that matter most.",
        ],
      ];
  return (
    <section
      className="premium-audience container"
      aria-labelledby="premium-audience-heading"
    >
      <p className="premium-kicker">
        {es ? "CONSTRUIDO ALREDEDOR DE TU VIDA" : "BUILT AROUND YOUR LIFE"}
      </p>
      <h2 id="premium-audience-heading">
        {es
          ? "Tu éxito merece una perspectiva más amplia."
          : "Your Success Deserves a Broader Perspective."}
      </h2>
      <div className="premium-audience-grid">
        {cards.map(([number, title, body]) => (
          <article key={number}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
