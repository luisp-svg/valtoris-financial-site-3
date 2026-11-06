import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import PublicLink from "../components/publicSite/PublicLink";
import { readPublicLocale } from "../components/publicSite/locale";
import { homeCopy } from "../components/publicSite/home/copy";
import { useHomeDocumentMeta } from "../components/publicSite/home/useHomeDocumentMeta";
import HomeFounderStory from "../components/publicSite/home/HomeFounderStory";
import HomeAskValtoris from "../components/publicSite/home/HomeAskValtoris";
import EditorialVisual from "../components/premium/EditorialVisual";
import AssessmentJourney from "../components/premium/AssessmentJourney";
import AnswerSection from "../components/publicSite/aeo/AnswerSection";
import "../components/premium/premium.css";
import "../components/premium/atelier.css";

export default function HomePage() {
  const location = useLocation();
  const locale = readPublicLocale(location.search),
    es = locale === "es",
    copy = homeCopy[locale];
  const t = (en: string, spanish: string) => (es ? spanish : en);
  useHomeDocumentMeta(copy);
  useEffect(() => {
    const target = location.hash.slice(1);
    if (target)
      document.getElementById(target)?.scrollIntoView({ block: "start" });
  }, [location.hash]);
  const audiences = [
    {
      name: t("Business Owners", "Dueños de negocios"),
      body: t(
        "An enterprise. A family. A future that connects them both.",
        "Una empresa. Una familia. Un futuro que las conecta.",
      ),
      to: "/business-owners",
      detail: t(
        "Business continuity, owner protection, benefits, and financial organization.",
        "Continuidad, protección, beneficios y organización financiera.",
      ),
    },
    {
      name: t("Accomplished Professionals", "Profesionales consolidados"),
      body: t(
        "Success brings more possibilities. And more decisions.",
        "El éxito trae más posibilidades. Y más decisiones.",
      ),
      to: "/personal-family",
      detail: t(
        "Connect income protection, student loans, homeownership, and retirement priorities.",
        "Conecta protección de ingresos, préstamos, vivienda y jubilación.",
      ),
    },
    {
      name: t("Established Families", "Familias establecidas"),
      body: t(
        "For the life you share. And the generations to come.",
        "Por la vida que comparten. Y las generaciones por venir.",
      ),
      to: "/private-client",
      detail: t(
        "Bring family protection, property, retirement, and legacy into one conversation.",
        "Coordina protección familiar, patrimonio, jubilación y legado.",
      ),
    },
  ];
  const solutions = [
    {
      title: t(
        "Business Formation & Financial Operations",
        "Formación y operaciones financieras",
      ),
      body: t(
        "A stronger foundation for the business you are building.",
        "Una base más sólida para la empresa que construyes.",
      ),
      links: [
        ["Business formation", "Formación empresarial", "/business-formation"],
        [
          "Business financial review",
          "Revisión financiera empresarial",
          "/business-report-card",
        ],
        ["Tax strategy coordination", "Coordinación fiscal", "/tax-strategy"],
      ],
    },
    {
      title: t(
        "Business Protection & Employee Benefits",
        "Protección empresarial y beneficios",
      ),
      body: t(
        "Consider the people, assets, and continuity behind your enterprise.",
        "Considera las personas, los activos y la continuidad de tu empresa.",
      ),
      links: [
        ["Commercial insurance", "Seguros comerciales", "/insurance"],
        [
          "Employee benefits",
          "Beneficios para empleados",
          "/business-report-card",
        ],
        [
          "Owner protection",
          "Protección del propietario",
          "/protection-analysis",
        ],
      ],
    },
    {
      title: t(
        "Personal & Lifestyle Protection",
        "Protección personal y estilo de vida",
      ),
      body: t(
        "Protection that reflects the life you have created.",
        "Protección que refleje la vida que has creado.",
      ),
      links: [
        [
          "Home, auto & lifestyle",
          "Hogar, auto y estilo de vida",
          "/report-card",
        ],
        [
          "Health coverage",
          "Cobertura de salud",
          "/health-insurance-report-card",
        ],
        ["Income protection", "Protección de ingresos", "/protection-analysis"],
        ["Amaze Health · $99/month", "Amaze Health · $99/mes", "/amaze-health"],
      ],
    },
    {
      title: t("Financial Optimization", "Optimización financiera"),
      body: t(
        "Create room for your next financial decision.",
        "Crea espacio para tu próxima decisión financiera.",
      ),
      links: [
        [
          "Student loans & PSLF review",
          "Revisión de préstamos y PSLF",
          "/student-loans",
        ],
        [
          "Credit & borrowing readiness",
          "Crédito y preparación financiera",
          "/credit",
        ],
      ],
    },
    {
      title: t("Retirement & Legacy", "Jubilación y legado"),
      body: t(
        "Give the next chapter the same care as the first.",
        "Dedica al próximo capítulo el mismo cuidado que al primero.",
      ),
      links: [
        [
          "Retirement, TSP & government benefits",
          "Jubilación, TSP y beneficios gubernamentales",
          "/retirement-report-card",
        ],
        ["Estate & legacy", "Patrimonio y legado", "/estate-legacy"],
      ],
    },
    {
      title: t("Homeownership & Real Estate", "Vivienda y bienes raíces"),
      body: t(
        "Prepare for a property decision within your broader financial picture.",
        "Prepara una decisión inmobiliaria con una perspectiva financiera más amplia.",
      ),
      links: [
        [
          "Homebuyer readiness",
          "Preparación para comprar vivienda",
          "/home-buyer-report-card",
        ],
        ["Property protection", "Protección de la propiedad", "/insurance"],
      ],
    },
  ];
  const protectionFirst = [solutions[2], solutions[1], solutions[4], solutions[5], solutions[3], solutions[0]];
  return (
    <div className="atelier-home site-home" id="valtoris-home">
      <section className="atelier-hero" aria-labelledby="home-hero-heading">
        <div className="atelier-hero-copy">
          <p className="atelier-eyebrow">
            {t(
              "FOR THOSE BUILDING SOMETHING LASTING",
              "PARA QUIENES CONSTRUYEN ALGO DURADERO",
            )}
          </p>
          <h1 id="home-hero-heading">{copy.heroTitle}</h1>
          <p className="atelier-hero-lead">
            {t(
              "Coordinated insurance and financial guidance for business owners, accomplished professionals, and established families—with attention to your property, liability, income, and legacy.",
              "Seguros y orientación financiera coordinados para dueños de negocios, profesionales consolidados y familias establecidas, con atención al patrimonio, responsabilidad, ingresos y legado.",
            )}
          </p>
          <PublicLink className="atelier-cta" to="/financial-assessment">
            {t(
              "Begin Your Financial Report Card",
              "Comenzar tu Report Card financiero",
            )}
            <span aria-hidden="true">↗</span>
          </PublicLink>
          <p className="atelier-hero-note">
            {t(
              "Complete your assessment. View your preliminary grade. Book your complimentary consultation.",
              "Completa tu evaluación. Consulta tu calificación preliminar. Reserva tu consulta sin costo.",
            )}
          </p>
        </div>
        <figure className="atelier-hero-image">
          <img
            src="/images/editorial/home-family-legacy-latino.webp"
            alt={t("A multigenerational family celebrating graduation at a lakeside home, with children, grandparents, cars and a boat", "Una familia multigeneracional celebra una graduación en una casa junto al lago, con niños, abuelos, autos y un barco")}
            width="1536"
            height="1024"
            {...{ fetchpriority: "high" }}
          />
          <figcaption>
            {t(
              "Protection. Strategy. Legacy.",
              "Protección. Estrategia. Legado.",
            )}
            <span>VALTORIS FINANCIAL</span>
          </figcaption>
        </figure>
        <div className="atelier-hero-bottom">
          <span>
            {t(
              "A complimentary introduction. A more intentional next step.",
              "Una primera consulta sin costo. Un siguiente paso más intencional.",
            )}
          </span>
          <PublicLink to="/schedule">
            {t("Reserve a Consultation", "Reservar una consulta")}{" "}
            <span aria-hidden="true">↗</span>
          </PublicLink>
        </div>
      </section>

      <section className="atelier-section protection-paths" aria-labelledby="protection-paths-heading">
        <p className="atelier-eyebrow">{t("START WITH WHAT YOU HAVE BUILT", "COMIENZA CON LO QUE HAS CONSTRUIDO")}</p>
        <h2 id="protection-paths-heading">{t("Protection for your family. Continuity for your business.", "Protección para tu familia. Continuidad para tu negocio.")}</h2>
        <div className="protection-path-grid">
          <article><h3>{t("Private Client & Family Protection", "Protección patrimonial y familiar")}</h3><p>{t("Multiple properties, vehicles, valuables, and growing liability exposure deserve a coordinated review.", "Varias propiedades, vehículos, objetos de valor y mayor responsabilidad merecen una revisión coordinada.")}</p><PublicLink to="/private-client">{t("Explore Private Client Protection", "Explorar protección patrimonial")} ↗</PublicLink></article>
          <article><h3>{t("Business Owner Protection", "Protección para dueños de negocios")}</h3><p>{t("Connect commercial exposures, owner income, employee benefits, and the household that depends on your business.", "Conecta riesgos comerciales, ingresos del dueño, beneficios y el hogar que depende de tu negocio.")}</p><PublicLink to="/business-owners">{t("Explore Business Owner Protection", "Explorar protección empresarial")} ↗</PublicLink></article>
        </div>
        <p>{t("Property and casualty coverage is coordinated through the Clearview Insurance Agency relationship. Availability depends on state, carrier, and underwriting.", "Los seguros patrimoniales y de responsabilidad se coordinan mediante la relación con Clearview Insurance Agency. La disponibilidad depende del estado, aseguradora y suscripción.")}</p>
      </section>

      <section
        className="atelier-section atelier-audiences"
        id="who-we-serve"
        aria-labelledby="audience-heading"
      >
        <div className="atelier-section-heading">
          <p className="atelier-eyebrow">
            {t("WHO WE SERVE", "A QUIÉNES SERVIMOS")}
          </p>
          <h2 id="audience-heading">
            {t("You have built something", "Has construido algo")}
            <br />
            <em>{t("worth protecting.", "que merece protección.")}</em>
          </h2>
          <p>
            {t(
              "For successful business owners, accomplished professionals, and established families whose financial lives deserve a broader perspective.",
              "Para dueños de negocios, profesionales consolidados y familias establecidas cuya vida financiera merece una perspectiva más amplia.",
            )}
          </p>
        </div>
        <div className="atelier-audience-list">
          {audiences.map((a, i) => (
            <article key={a.name}>
              <span className="atelier-index">0{i + 1}</span>
              <div>
                <h3>{a.name}</h3>
                <p>{a.body}</p>
                <small>{a.detail}</small>
              </div>
              <PublicLink
                to={a.to}
                aria-label={`${t("Explore", "Explorar")} ${a.name}`}
              >
                <span aria-hidden="true">↗</span>
              </PublicLink>
            </article>
          ))}
        </div>
      </section>

      <EditorialVisual kind="family" />
      <section
        className="atelier-assessment"
        id="home-diagnostics"
        aria-labelledby="assessment-heading"
      >
        <div
          className="atelier-report-object"
          aria-label={t(
            "Illustrative Report Card cover, not a client result",
            "Portada ilustrativa, no es un resultado de cliente",
          )}
        >
          <div className="atelier-report-top">
            VALTORIS <span>FINANCIAL</span>
          </div>
          <p>
            {t(
              "A PERSONAL FINANCIAL PERSPECTIVE",
              "UNA PERSPECTIVA FINANCIERA PERSONAL",
            )}
          </p>
          <h3>
            {t("Your Financial", "Tu Report Card")}
            <br />
            <em>{t("Report Card.", "financiero.")}</em>
          </h3>
          <div className="atelier-report-rule" />
          <span className="atelier-report-label">
            {t("PRELIMINARY REVIEW", "REVISIÓN PRELIMINAR")}
          </span>
          <div className="atelier-report-bottom">
            {t(
              "Prepared around your priorities",
              "Preparado según tus prioridades",
            )}
            <span>01 —</span>
          </div>
        </div>
        <div className="atelier-assessment-copy">
          <p className="atelier-eyebrow">
            {t(
              "THE VALTORIS FINANCIAL ASSESSMENT",
              "LA EVALUACIÓN FINANCIERA VALTORIS",
            )}
          </p>
          <h2 id="assessment-heading">
            {t("Your success deserves", "Tu éxito merece")}
            <br />
            <em>{t("a closer look.", "una mirada más cercana.")}</em>
          </h2>
          <p>
            {t(
              "Your financial life does not fit into a single category. Your starting point should reflect that.",
              "Tu vida financiera no cabe en una sola categoría. Tu punto de partida debe reflejarlo.",
            )}
          </p>
          <p>
            {t(
              "Start with a short, specialized Report Card: student loans and health first, followed by home and auto, commercial insurance and trucking. Broader Family or Business Owner discovery is optional, with your prior answers carried forward.",
              "Comienza con un Report Card especializado: préstamos y salud primero, después hogar y auto, seguro comercial y transporte. La revisión familiar o empresarial es opcional y conserva tus respuestas.",
            )}
          </p>
          <PublicLink className="atelier-cta" to="/financial-assessment">
            {t("Choose Your Priorities", "Seleccionar tus prioridades")}
            <span aria-hidden="true">↗</span>
          </PublicLink>
          <p className="atelier-disclosure">
            {t(
              "Complete 5–10 focused questions, see your preliminary results, and book a complimentary consultation immediately. Comprehensive discovery never blocks booking.",
              "Responde 5–10 preguntas, mira tus resultados preliminares y reserva una consulta sin costo de inmediato. La revisión integral nunca bloquea la reserva.",
            )}
          </p>
          <PublicLink className="atelier-text-link" to="/report-cards">
            {t(
              "Explore individual Report Cards",
              "Explorar Report Cards individuales",
            )}{" "}
            ↗
          </PublicLink>
        </div>
      </section>

      <section
        className="atelier-section atelier-solutions"
        id="our-solutions"
        aria-labelledby="solutions-heading"
      >
        <div className="atelier-section-heading">
          <p className="atelier-eyebrow">
            {t("OUR SOLUTIONS", "NUESTRAS SOLUCIONES")}
          </p>
          <h2 id="solutions-heading">
            {t("One financial life.", "Una vida financiera.")}
            <br />
            <em>
              {t("A connected perspective.", "Una perspectiva conectada.")}
            </em>
          </h2>
          <p>
            {t(
              "Start with what matters now. Explore the appropriate specialist services as your priorities become clear.",
              "Comienza con lo que importa ahora. Explora servicios especializados según se aclaren tus prioridades.",
            )}
          </p>
          <PublicLink className="atelier-text-link" to="/solutions">
            {t("Explore All Solutions", "Explorar soluciones")} ↗
          </PublicLink>
        </div>
        <div className="atelier-solution-list">
          {protectionFirst.map((s, i) => (
            <details key={s.title}>
              <summary>
                <span className="atelier-index">0{i + 1}</span>
                <h3>{s.title}</h3>
                <span className="atelier-expand" aria-hidden="true">
                  +
                </span>
              </summary>
              <div className="atelier-solution-content">
                <p>{s.body}</p>
                <nav aria-label={s.title}>
                  {s.links.map(([en, sp, to]) => (
                    <PublicLink key={to} to={to}>
                      {t(en, sp)} <span aria-hidden="true">↗</span>
                    </PublicLink>
                  ))}
                </nav>
                {i === 5 && (
                  <small>
                    {t(
                      "Real estate coordination, when appropriate, through a professional partnership.",
                      "Coordinación inmobiliaria, cuando corresponda, mediante una colaboración profesional.",
                    )}
                  </small>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>

      <EditorialVisual kind="lifestyle" />
      <section
        className="atelier-section atelier-experience"
        id="our-process"
        aria-labelledby="experience-heading"
      >
        <div className="atelier-section-heading">
          <p className="atelier-eyebrow">
            {t("THE CLIENT EXPERIENCE", "LA EXPERIENCIA DEL CLIENTE")}
          </p>
          <h2 id="experience-heading">
            {t("Clarity, before", "Claridad, antes de")}
            <br />
            <em>{t("the next decision.", "la próxima decisión.")}</em>
          </h2>
          <p>
            {t(
              "A transparent process from your first question to your strategy conversation. Deeper intake stays within your consultation.",
              "Un proceso transparente desde tu primera pregunta hasta la conversación estratégica. La información detallada se completa durante la consulta.",
            )}
          </p>
          <p className="atelier-disclosure">
            {t(
              "Your Report Card is a preliminary educational diagnostic. It does not replace a complete financial review or determine whether a product or program is suitable.",
              "Tu Report Card es un diagnóstico educativo preliminar. No sustituye una revisión financiera completa ni determina si un producto o programa es adecuado.",
            )}
          </p>
        </div>
        <AssessmentJourney locale={locale} />
      </section>

      <section
        className="atelier-philosophy"
        aria-labelledby="philosophy-heading"
      >
        <p className="atelier-eyebrow">
          {t("THE VALTORIS PHILOSOPHY", "LA FILOSOFÍA VALTORIS")}
        </p>
        <h2 id="philosophy-heading">
          {t("Understand first.", "Comprender primero.")}
          <br />
          <em>{t("Move forward with purpose.", "Avanzar con propósito.")}</em>
        </h2>
        <p>
          {t(
            "We begin with your circumstances, your responsibilities, and what you want to preserve. The strategy comes before the solution.",
            "Comenzamos con tus circunstancias, tus responsabilidades y lo que deseas preservar. La estrategia viene antes que la solución.",
          )}
        </p>
      </section>
      <div className="atelier-founder" id="about-valtoris">
        <HomeFounderStory copy={copy} />
        <details className="atelier-team">
          <summary>
            {t(
              "Meet our specialist team",
              "Conoce a nuestro equipo especializado",
            )}{" "}
            <span aria-hidden="true">+</span>
          </summary>
          <div>
            <img
              src="/images/advisors/liz.jpg"
              alt={t(
                "Liz, Student Loan Strategist and Health Specialist",
                "Liz, estratega de préstamos estudiantiles y especialista en salud",
              )}
              width="841"
              height="1280"
              loading="lazy"
            />
            <section>
              <p className="atelier-eyebrow">{t("MEET LIZ", "CONOCE A LIZ")}</p>
              <h3>
                {t(
                  "Student Loan Strategist & Health Specialist",
                  "Estratega de préstamos estudiantiles y especialista en salud",
                )}
              </h3>
              <p>
                {t(
                  "10 years of experience helping individuals and families understand their options and clarify their next steps.",
                  "10 años de experiencia ayudando a personas y familias a comprender sus opciones y definir sus próximos pasos.",
                )}
              </p>
              <PublicLink className="atelier-text-link" to="/student-loans">
                {t(
                  "Explore student loan services",
                  "Explorar servicios de préstamos estudiantiles",
                )}{" "}
                ↗
              </PublicLink>
            </section>
          </div>
        </details>
      </div>
      <section
        className="atelier-section atelier-insights"
        id="insights"
        aria-labelledby="insights-heading"
      >
        <p className="atelier-eyebrow">
          {t("PREPARE FOR YOUR REVIEW", "PREPÁRATE PARA TU REVISIÓN")}
        </p>
        <h2 id="insights-heading">
          {t(
            "Questions worth considering.",
            "Una perspectiva mejor informada.",
          )}
        </h2>
        <div className="atelier-insight-links">
          <PublicLink to="/education">
            {t(
              "Read the planning guides",
              "Explorar la biblioteca educativa",
            )}{" "}
            ↗
          </PublicLink>
          <PublicLink to="/report-cards">
            {t("Find your Report Card", "Encuentra tu Report Card")} ↗
          </PublicLink>
        </div>
        <details className="atelier-resource-guide">
          <summary>
            {t(
              "Have a question? Find a starting point.",
              "¿Tienes una pregunta? Encuentra un punto de partida.",
            )}
            <span aria-hidden="true">+</span>
          </summary>
          <HomeAskValtoris locale={locale} />
          <AnswerSection page="home" locale={locale} />
        </details>
      </section>
      <section className="atelier-closing" aria-labelledby="closing-heading">
        <p className="atelier-eyebrow">
          {t("YOUR NEXT CHAPTER", "TU PRÓXIMO CAPÍTULO")}
        </p>
        <h2 id="closing-heading">
          {t("Begin with what", "Comienza con lo que")}
          <br />
          <em>{t("matters most.", "más importa.")}</em>
        </h2>
        <PublicLink className="atelier-cta" to="/financial-assessment">
          {t(
            "Begin Your Financial Report Card",
            "Comenzar tu Report Card financiero",
          )}
          <span aria-hidden="true">↗</span>
        </PublicLink>
        <PublicLink className="atelier-text-link" to="/schedule">
          {t("Or reserve a conversation", "O reserva una conversación")} ↗
        </PublicLink>
      </section>
    </div>
  );
}
