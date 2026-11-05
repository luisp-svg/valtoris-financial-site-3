import FunnelAnswers from "../publicSite/aeo/FunnelAnswers";
import { funnelContent, type DiscoverableFunnel } from "../publicSite/aeo/funnelContent";
import EditorialVisual from "./EditorialVisual";
import { useLocation } from "react-router-dom";
import { readPublicLocale } from "../publicSite/locale";
import PublicLink from "../publicSite/PublicLink";
import { useHomeDocumentMeta } from "../publicSite/home/useHomeDocumentMeta";
import {
  PRIORITIES,
  type Priority,
} from "../../modules/reportCard/combined/engine";
import "./premium.css";
import "./atelier.css";
import AssessmentJourney from "./AssessmentJourney";
const reviewNames: Record<Priority, [string, string]> = {
 commercial:["Commercial Insurance Review","Revisión de seguro comercial"], trucking:["Commercial Trucking Review","Revisión de transporte comercial"],
  family: [
    "Family Financial Report Card",
    "Revisión financiera y protección familiar",
  ],
  business: [
    "Business Owner Financial Report Card",
    "Revisión estratégica para dueños de negocios",
  ],
  home_buyer: [
    "Homebuyer Readiness Review",
    "Revisión de preparación para comprar vivienda",
  ],
  retirement: ["Retirement & Legacy Review", "Revisión de jubilación y legado"],
  tsp: [
    "TSP & Federal Retirement Review",
    "Revisión de TSP y jubilación federal",
  ],
  health: ["Health Coverage Review", "Revisión de cobertura de salud"],
  student_loan: [
    "Student Loan Strategy Review",
    "Revisión de préstamos estudiantiles",
  ],
  credit: [
    "Credit & Financing Readiness Review",
    "Revisión de crédito y preparación financiera",
  ],
  lifestyle: [
    "Lifestyle & Asset Protection Review",
    "Revisión de protección patrimonial y estilo de vida",
  ],
  benefits: [
    "Employee Benefits Review",
    "Revisión de beneficios para empleados",
  ],
  protection: [
    "Income Protection Review",
    "Revisión de protección de ingresos",
  ],
  tax: ["Tax Planning Coordination Review", "Revisión de coordinación fiscal"],
};
const reviewPromises: Record<Priority, [string, string]> = {
 commercial:["Review coverage for business operations and property.","Revisa cobertura para operaciones y propiedad del negocio."],trucking:["Review commercial trucks, cargo and operating requirements.","Revisa camiones, carga y requisitos de operación."],
  family: [
    "Bring family protection, household responsibilities, and future priorities into one considered review.",
    "Coordina protección familiar, responsabilidades del hogar y prioridades futuras en una revisión cuidadosa.",
  ],
  business: [
    "Review the people, continuity, and financial responsibilities behind the business you have built.",
    "Revisa las personas, la continuidad y las responsabilidades financieras de la empresa que has construido.",
  ],
  home_buyer: [
    "Consider credit, cash flow, and purchase readiness before your next property decision.",
    "Considera crédito, flujo de efectivo y preparación antes de tu próxima decisión inmobiliaria.",
  ],
  retirement: [
    "Organize retirement readiness and legacy questions around the next chapter of your life.",
    "Organiza tu preparación para la jubilación y tus preguntas sobre legado alrededor del próximo capítulo.",
  ],
  tsp: [
    "Clarify the TSP and federal retirement details worth reviewing before making a transition.",
    "Aclara los detalles de TSP y jubilación federal que conviene revisar antes de una transición.",
  ],
  health: [
    "Consider your current coverage, household needs, and the questions to bring to a health coverage review.",
    "Considera tu cobertura actual, necesidades del hogar y preguntas para una revisión de salud.",
  ],
  student_loan: [
    "Organize your loan picture and the repayment or PSLF questions that deserve a closer look.",
    "Organiza tus préstamos y las preguntas sobre pagos o PSLF que merecen una mirada más cercana.",
  ],
  credit: [
    "Understand your reported credit picture and the financing priorities you want to prepare for.",
    "Comprende tu situación crediticia reportada y las prioridades financieras para las que deseas prepararte.",
  ],
  lifestyle: [
    "Review the home, vehicles, property, and liability exposures that support the life you have created.",
    "Revisa hogar, vehículos, propiedades y riesgos de responsabilidad alrededor de la vida que has creado.",
  ],
  benefits: [
    "Review costs. Support your employees. Simplify benefits with a strategy built around your business.",
    "Revisa costos. Apoya a tus empleados. Simplifica beneficios con una estrategia para tu negocio.",
  ],
  protection: [
    "Consider how your income protection aligns with the people and responsibilities that depend on you.",
    "Considera cómo la protección de tus ingresos se alinea con las personas y responsabilidades que dependen de ti.",
  ],
  tax: [
    "Organize tax-planning questions for coordination with appropriately qualified professionals.",
    "Organiza preguntas de planificación fiscal para coordinar con profesionales debidamente calificados.",
  ],
};
const reviewTopics: Record<Priority, [string[], string[]]> = {
 commercial:[["Liability and property","Operations and contracts"],["Responsabilidad y propiedad","Operaciones y contratos"]],trucking:[["Commercial auto liability","Cargo, drivers and filings"],["Responsabilidad de auto comercial","Carga, conductores y registros"]],
  family: [['Household responsibilities and dependents', 'Protection, debt and cash-flow priorities', 'Questions for your family strategy conversation'], ['Responsabilidades del hogar y dependientes', 'Protección, deudas y flujo de efectivo', 'Preguntas para tu estrategia familiar']],
  business: [['Owner and key-person responsibilities', 'Business continuity and financial organization', 'Employee benefits and business priorities'], ['Responsabilidades del dueño y personas clave', 'Continuidad y organización financiera', 'Beneficios y prioridades del negocio']],
  home_buyer: [['Credit and borrowing readiness', 'Savings, down payment and monthly obligations', 'Questions to discuss with a real estate professional'], ['Crédito y preparación financiera', 'Ahorros, pago inicial y obligaciones mensuales', 'Preguntas para un profesional inmobiliario']],
  retirement: [['Your timeline and retirement goals', 'Savings and anticipated income needs', 'Family and legacy considerations'], ['Tu plazo y metas de jubilación', 'Ahorros y necesidades de ingresos', 'Consideraciones familiares y de legado']],
  tsp: [['Federal or military service and transition timing', 'TSP contributions and retirement priorities', 'Questions about future income and beneficiaries'], ['Servicio federal o militar y transición', 'Aportaciones TSP y prioridades de jubilación', 'Preguntas sobre ingresos y beneficiarios']],
  health: [['Current coverage and household needs', 'Coverage gaps and affordability questions', 'Priorities for a licensed coverage review'], ['Cobertura actual y necesidades del hogar', 'Brechas de cobertura y costos', 'Prioridades para revisar con un profesional autorizado']],
  student_loan: [['Loan types and current repayment picture', 'Payment concerns and forgiveness questions', 'Information to organize before your consultation'], ['Tipos de préstamos y pagos actuales', 'Preguntas sobre pagos y condonación', 'Información para organizar antes de tu consulta']],
  credit: [['Your self-reported credit picture', 'Debt obligations and financing goals', 'Areas to review before your next application'], ['Tu situación crediticia reportada', 'Deudas y metas de financiamiento', 'Áreas para revisar antes de una solicitud']],
  lifestyle: [['Home, vehicles and recreational assets', 'Current property coverage and liability questions', 'Changes in the life and assets you want to protect'], ['Hogar, vehículos y bienes recreativos', 'Cobertura de propiedad y responsabilidad', 'Cambios en tu vida y bienes a proteger']],
  benefits: [['Your workforce and current benefits', 'Employer priorities and coverage needs', 'Questions for a coordinated benefits conversation'], ['Tu equipo y beneficios actuales', 'Prioridades del empleador y cobertura', 'Preguntas para coordinar los beneficios']],
  protection: [['People who depend on your income', 'Existing coverage and financial obligations', 'Potential protection gaps worth discussing'], ['Personas que dependen de tus ingresos', 'Cobertura actual y obligaciones financieras', 'Posibles brechas de protección a revisar']],
  tax: [['Personal and business planning priorities', 'Financial organization and coordination needs', 'Questions for your qualified tax professional'], ['Prioridades personales y del negocio', 'Organización financiera y coordinación', 'Preguntas para tu profesional fiscal']],
};
export default function PremiumFunnelLanding({
  priority,
}: {
  priority: Priority;
}) {
  const location = useLocation(),
    locale = readPublicLocale(location.search),
    es = locale === "es",
    discoverable = priority in funnelContent ? priority as DiscoverableFunnel : null,
    entry = discoverable ? funnelContent[discoverable][locale] : null,
    title = entry?.title ?? reviewNames[priority][es ? 1 : 0];
  useHomeDocumentMeta({
    metaTitle: `${title} | Valtoris Financial`,
    metaDescription: entry?.summary ?? (es
      ? "Una revisión educativa enfocada en tus prioridades. Mira resultados preliminares y reserva una consulta sin costo."
      : "A focused educational review built around your priorities. See preliminary results and book a complimentary consultation."),
  });
  return (
    <div className="premium-funnel">
      <section className="premium-funnel-hero container premium-funnel-hero--visual">
        <div className="premium-funnel-intro">
        <p className="premium-kicker">
          {es ? "UNA PERSPECTIVA MÁS CLARA" : "A CLEARER PERSPECTIVE"}
        </p>
        <h1>{title}</h1>
        <p className="premium-lead">{entry?.summary ?? reviewPromises[priority][es ? 1 : 0]}</p>
        {entry && <p className="premium-fineprint">{entry.audience}</p>}
        <p className="premium-fineprint">
          {priority==="family"||priority==="business" ? (es?"Revisión integral opcional después de un Report Card especializado. Tus respuestas se conservan; no es necesario completarla para reservar.":"Optional comprehensive discovery after a specialized Report Card. Prior answers carry forward; this review is never required to book.") : es
            ? "Responde 5–10 preguntas, mira tus resultados preliminares y reserva una consulta sin costo. La revisión familiar o empresarial es opcional."
            : "Answer 5–10 focused questions, see useful preliminary results, and book a complimentary consultation. Optional Family or Business Owner discovery follows."}
        </p>
        <PublicLink
          className="premium-button"
          to={priority==="family"||priority==="business"?"/solutions":`/financial-assessment?focus=${priority}&priorities=${priority}`}
        >
          {es ? "Comenzar mi evaluación" : "Begin My Assessment"} ↗
        </PublicLink>
        <p className="premium-fineprint">
          {es
            ? "Tus respuestas se conservan para la revisión integral opcional."
            : "Your answers carry forward into optional comprehensive discovery."}
        </p>
        </div>
      <EditorialVisual
        kind={
          ["business", "home_buyer", "lifestyle", "tax", "commercial", "trucking"].includes(priority)
            ? "lifestyle"
            : "family"
        }
      />
      </section>
      <section className="premium-review-focus container" aria-labelledby="review-focus-heading">
        <h2 id="review-focus-heading">{es ? 'Qué vamos a revisar' : 'What This Review Covers'}</h2>
        <ul>{(entry?.topics ?? reviewTopics[priority][es ? 1 : 0]).map(topic => <li key={topic}>{topic}</li>)}</ul>
      </section>
      {priority === "benefits" && <section className="premium-review-focus container">
        <h2>{es ? "Beneficios que apoyan a tu equipo y tu negocio" : "Benefits That Support Your People and Your Business"}</h2>
        <h3>{es ? "Para el empleador" : "For employers"}</h3><p>{es ? "Revisa costos, prioridades de retención y coordinación de nómina. Compara propuestas específicas para tu equipo con apoyo de Valtoris y nuestro socio de beneficios DCBG." : "Review costs, retention priorities and payroll coordination. Compare proposals built for your workforce with support from Valtoris and our benefits partner DCBG."}</p>
        <h3>{es ? "Para los empleados" : "For employees"}</h3><p>{es ? "Comprende las opciones, los costos y cómo usar los beneficios disponibles. La educación y el apoyo continúan después de la inscripción." : "Understand the choices, costs and how to use available benefits. Education and support continue after enrollment."}</p>
        <h3>{es ? "Coberturas con funciones distintas" : "Different Coverage, Different Roles"}</h3><p>{es ? "La cobertura médica mayor y los beneficios suplementarios de bienestar cumplen funciones distintas. Los suplementos no sustituyen un seguro médico mayor. Revisaremos las opciones actuales antes de considerar cambios." : "Major medical coverage and supplemental wellness benefits serve different purposes. Supplemental benefits do not replace major medical insurance. We review existing arrangements before considering changes."}</p>
        <h3>{es ? "De la revisión al apoyo continuo" : "From Review to Ongoing Support"}</h3><ol>{(es ? ["Revisión inicial y consulta", "Censo por un proceso seguro y análisis del socio", "Propuesta específica con supuestos, costos y términos", "Implementación, nómina y educación del equipo", "Servicio continuo y revisión programada"] : ["Initial review and consultation", "Secure census collection and partner analysis", "Employer-specific proposal with assumptions, costs and terms", "Implementation, payroll coordination and employee education", "Ongoing service and scheduled review"]).map(item => <li key={item}>{item}</li>)}</ol>
        <p>{es ? "Cualquier proyección de ahorro requiere una propuesta específica del socio. No se garantiza elegibilidad, ahorro ni tratamiento fiscal. No ingreses datos individuales de empleados en el Report Card." : "Any savings projection requires an employer-specific partner proposal. Eligibility, savings and tax treatment are not guaranteed. Do not enter individual employee information in the Report Card."}</p>
      </section>}
      {discoverable && <FunnelAnswers priority={discoverable} locale={locale} />}
      <section className="premium-funnel-process container">
        <p className="premium-kicker">
          {es
            ? "UNA CONVERSACIÓN CON PROPÓSITO"
            : "A CONVERSATION WITH PURPOSE"}
        </p>
        <h2>
          {es
            ? "Un siguiente paso más intencional."
            : "A More Intentional Next Step."}
        </h2>
        <AssessmentJourney locale={locale} />
      </section>
      <section className="premium-funnel-note container">
        <h2>{PRIORITIES.find((p) => p.id === priority)![locale]}</h2>
        <p>
          {es
            ? "Tus Report Cards conservan sus criterios educativos. Las calificaciones, cuando corresponden, describen el área específica revisada; no son una calificación general de tu vida financiera."
            : "Your Report Cards retain their educational criteria. Grades, where applicable, describe the specific area reviewed; they are not a single rating of your financial life."}
        </p>
        {priority === "tsp" && (
          <p>
            {es
              ? "Revisión independiente, sin afiliación con TSP ni el gobierno federal. No recomienda transferencias ni inversiones."
              : "Independent review, not affiliated with TSP or the federal government. No rollover or investment recommendation."}
          </p>
        )}
        <p>
          {es
            ? "Las opciones dependen de tu situación y de la disponibilidad en tu estado. No se garantizan aprobaciones, cobertura, ahorros ni resultados."
            : "Options depend on your circumstances and availability in your state. Approval, coverage, savings, and outcomes are not guaranteed."}
        </p>
      </section>
    </div>
  );
}
