import { lifestyleResults } from "./lifestyleResults.js";
import { buildShortResult } from "../shortForm/results.js";
import { guidedResult } from "../specialtyPreview/submission.js";
import {
  PRIORITIES,
  projectDiagnostic,
  type CombinedAnswers,
} from "./legacyEngine.js";
import type { LegacyPublicReportCardAssessmentType } from "../publicIngestCatalog.js";
import {
  SPECIALTY_CARDS,
  type NewSpecialty,
} from "../specialtyPreview/catalog.js";

/** No aggregate grade: these existing reviews measure different things. */
export function combinedResults(
  answers: Pick<CombinedAnswers, "selected" | "diagnostic" | "locale" | "consultationOnly">,
) {
  if (answers.consultationOnly) return [];
  return answers.selected.map((type) => {
    const title = PRIORITIES.find((p) => p.id === type)![answers.locale];
    const diagnostic = projectDiagnostic(type, answers.diagnostic);
    if (type === "lifestyle")
      return {
        type,
        title,
        kind: "lifestyle" as const,
        result: lifestyleResults(diagnostic, answers.locale),
      };
    if (["health", "tsp", "benefits", "tax"].includes(type))
      return {
        type,
        title,
        kind: "guided" as const,
        note: type === "benefits" ? "" : SPECIALTY_CARDS[type as NewSpecialty].note[answers.locale],
        sources: type === "benefits" ? [] : SPECIALTY_CARDS[type as NewSpecialty].source,
        result: guidedResult(type as NewSpecialty, diagnostic, answers.locale),
      };
    return {
      type,
      title,
      kind: "short" as const,
      result: buildShortResult(
        type as LegacyPublicReportCardAssessmentType,
        diagnostic,
      ),
    };
  });
}
