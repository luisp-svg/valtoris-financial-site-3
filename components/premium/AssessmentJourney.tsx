export default function AssessmentJourney({
  locale = "en",
}: {
  locale?: "en" | "es";
}) {
  const es = locale === "es";
  const steps = es
    ? [
        [
          "Completa tu Report Card",
          "Comparte tus prioridades y responde preguntas relevantes, sin repetir información compatible.",
        ],
        [
          "Reserva tu revisión sin costo",
          "Elige una hora para tu consulta antes de acceder a los resultados detallados.",
        ],
        [
          "Explora tus resultados preliminares",
          "Revisa tus categorías, observaciones y preguntas para la conversación.",
        ],
        [
          "Conversa con un especialista",
          "Revisen los hallazgos y completen juntos la información de consulta.",
        ],
        [
          "Define tus próximos pasos",
          "Conversa sobre prioridades, opciones y el alcance de un plan de acción apropiado.",
        ],
      ]
    : [
        [
          "Complete Your Financial Report Card",
          "Share your priorities and answer focused questions, with compatible shared information requested once.",
        ],
        [
          "Reserve Your Complimentary Review",
          "Choose a consultation time before accessing your detailed report.",
        ],
        [
          "Access Your Personalized Report Card",
          "Explore preliminary findings, priorities, and questions to discuss.",
        ],
        [
          "Attend Your Financial Strategy Review",
          "Review the findings and complete the deeper consultation intake together.",
        ],
        [
          "Discuss Your Recommended Action Plan",
          "Clarify priorities, appropriate options, and the scope of your next steps.",
        ],
      ];
  return (
    <ol className="atelier-journey">
      {steps.map(([title, body], i) => (
        <li key={title}>
          <span aria-hidden="true">0{i + 1}</span>
          <div>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
