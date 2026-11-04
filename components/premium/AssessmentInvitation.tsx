import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { readPublicLocale } from "../publicSite/locale";
import { type Priority } from "../../modules/reportCard/combined/engine";
import PrioritySelector from "./PrioritySelector";
import "./premium.css";
import "./atelier.css";
export default function AssessmentInvitation({
  headingLevel = "h2",
}: {
  headingLevel?: "h1" | "h2";
}) {
  const location = useLocation(),
    navigate = useNavigate(),
    locale = readPublicLocale(location.search),
    es = locale === "es";
  const [selected, setSelected] = useState<Priority[]>([]);
  const Heading = headingLevel;
  function begin() {
    const query = new URLSearchParams(location.search);
    query.set("priorities", selected.join(","));
    navigate(`/financial-assessment?${query.toString()}`);
  }
  return (
    <section className="premium-invitation" aria-labelledby="priority-heading">
      <div className="container">
        <div className="premium-invitation-intro">
          <p className="premium-kicker">
            {es
              ? "LA EVALUACIÓN FINANCIERA VALTORIS"
              : "THE VALTORIS FINANCIAL ASSESSMENT"}
          </p>
          <Heading id="priority-heading">
            {es
              ? "¿Qué te gustaría fortalecer?"
              : "What Would You Like to Strengthen?"}
          </Heading>
          <p>
            {es
              ? "Selecciona una o varias prioridades. Organizaremos una revisión coordinada con preguntas que se adaptan a ti, sin repetir la misma información."
              : "Select one or several priorities. We’ll organize a coordinated review with questions that adapt to you, without asking for the same information twice."}
          </p>
        </div>
        <PrioritySelector
          selected={selected}
          onChange={setSelected}
          locale={locale}
        />
        <div className="premium-selection-footer">
          <p aria-live="polite">
            {selected.length
              ? es
                ? `${selected.length} prioridades seleccionadas`
                : `${selected.length} ${selected.length === 1 ? "priority" : "priorities"} selected`
              : es
                ? "Selecciona lo que importa en esta etapa."
                : "Choose what matters at this stage of your life."}
          </p>
          <button
            className="premium-button"
            disabled={!selected.length}
            onClick={begin}
          >
            {es ? "Preparar mi evaluación" : "Begin My Assessment"}{" "}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
        <p className="premium-fineprint">
          {es
            ? "Evaluación educativa · Consulta inicial sin costo · Resultados detallados después de reservar tu consulta"
            : "Educational assessment · Complimentary initial consultation · Detailed results after booking your consultation"}
        </p>
      </div>
    </section>
  );
}
