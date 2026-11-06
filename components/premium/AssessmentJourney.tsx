export default function AssessmentJourney({
  locale = "en",
  showDiscovery = true,
}: {
  locale?: "en" | "es";
  showDiscovery?: boolean;
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
          "Mira tus resultados preliminares y elige una consulta sin costo.",
        ],
        [
          "Revisión familiar o empresarial opcional",
          "Amplía la revisión sin repetir respuestas. Esta etapa no bloquea la reserva.",
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
          "See your preliminary results and choose a complimentary consultation time.",
        ],
        [
          "Optional Family or Business Owner Discovery",
          "Broaden the review with prior answers carried forward. You can book without completing this stage.",
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
      {(showDiscovery ? steps : steps.filter((_, index) => index !== 2)).map(([title, body], i) => (
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
