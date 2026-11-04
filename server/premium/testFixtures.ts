import {
  COMBINED_FORMAT,
  orderedPriorities,
  combinedQuestions,
  pruneCombined,
  validCombinedQuestion,
  type CombinedAnswers,
  type Priority,
} from "../../modules/reportCard/combined/engine.js";
import type { ShortDiagnostic } from "../../modules/reportCard/shortForm/contract.js";
/** Synthetic fixtures only. No external delivery is performed by this helper. */
export function combinedFixture(
  selected: Priority[] = ["family", "business", "health"],
): CombinedAnswers {
  const insuranceRoutingVersion = selected.some(t=>["lifestyle","commercial","trucking"].includes(t)) ? 1 as const : undefined;
  let diagnostic: ShortDiagnostic = {};
  for (let pass = 0; pass < 8; pass++) {
    for (const q of combinedQuestions(selected, diagnostic, insuranceRoutingVersion)) {
      if (diagnostic[q.id] !== undefined) continue;
      diagnostic[q.id] = validCombinedQuestion(q, "unknown")
        ? "unknown"
        : q.question.kind === "multi"
          ? ["unknown"]
          : q.question.kind === "number"
            ? "1"
            : q.question.options![0].value;
    }
    diagnostic = pruneCombined(selected, diagnostic, insuranceRoutingVersion);
  }
  return {
    format: COMBINED_FORMAT,
    ...(insuranceRoutingVersion?{insuranceRoutingVersion}:{}),
    selected: orderedPriorities(selected),
    diagnostic,
    locale: "en",
    contact: {
      fullName: "Preview Visitor",
      email: "preview@example.com",
      phone: "+1 202-555-0100",
    },
  };
}
