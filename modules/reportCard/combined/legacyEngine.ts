import { normalizePhone } from "../../../crm/households/normalizeContact.js";
import {
  SHORT_CARDS,
  type ShortQuestion,
  type Locale,
} from "../shortForm/catalog.js";
import {
  validQuestion,
  validShortContact,
  visibleQuestions as shortVisible,
  validateShortAnswers,
  type ShortDiagnostic,
} from "../shortForm/contract.js";
import {
  SPECIALTY_CARDS,
  type Question,
  type Answers,
  type NewSpecialty,
} from "../specialtyPreview/catalog.js";
import {
  visibleQuestions as guidedVisible,
  valid as guidedValid,
  error as guidedError,
} from "../specialtyPreview/engine.js";
import { validateGuidedReport } from "../specialtyPreview/submission.js";
import type {
  LegacyPublicReportCardAssessmentType,
  PublicReportCardAssessmentType,
} from "../publicIngestCatalog.js";

export const COMBINED_FORMAT = "combined-priorities-v1" as const;
export const COMBINED_VERSION = 6;
export const PRIORITIES = [
  { id: "family", en: "Protect my family", es: "Proteger a mi familia" },
  {
    id: "business",
    en: "Protect and strengthen my business",
    es: "Proteger y fortalecer mi negocio",
  },
  {
    id: "home_buyer",
    en: "Prepare to purchase a home",
    es: "Prepararme para comprar una vivienda",
  },
  {
    id: "retirement",
    en: "Prepare for retirement and legacy decisions",
    es: "Prepararme para la jubilación y el legado",
  },
  {
    id: "tsp",
    en: "Review my TSP and federal retirement",
    es: "Revisar mi TSP y jubilación federal",
  },
  {
    id: "health",
    en: "Review health and supplemental coverage",
    es: "Revisar cobertura de salud y suplementaria",
  },
  {
    id: "student_loan",
    en: "Evaluate my student loan options",
    es: "Evaluar mis opciones de préstamos estudiantiles",
  },
  {
    id: "credit",
    en: "Improve credit and financing readiness",
    es: "Mejorar mi preparación crediticia y financiera",
  },
  {
    id: "lifestyle",
    en: "Protect my home, vehicles, and lifestyle",
    es: "Proteger mi hogar, vehículos y estilo de vida",
  },
  {
    id: "benefits",
    en: "Review benefits for my employees",
    es: "Revisar beneficios para mis empleados",
  },
  {
    id: "protection",
    en: "Review my income protection needs",
    es: "Revisar mis necesidades de protección de ingresos",
  },
  {
    id: "tax",
    en: "Coordinate tax-planning questions",
    es: "Coordinar preguntas de planificación fiscal",
  },
] as const;
export type Priority = (typeof PRIORITIES)[number]["id"];
export type CombinedAnswers = {
  format: typeof COMBINED_FORMAT;
  consultationOnly?: true;
  selected: Priority[];
  diagnostic: ShortDiagnostic;
  contact: { fullName: string; email: string; phone: string };
  locale: Locale;
};
export type CombinedQuestion = {
  id: string;
  question: ShortQuestion;
  reviews: Priority[];
};
const guidedTypes = new Set<Priority>(["health", "tsp", "benefits", "tax"]);
const c = (en: string, es: string) => ({ en, es });
import { lifestyleQuestions, visibleLifestyleQuestions } from "./lifestyle.js";

export function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && PRIORITIES.some((p) => p.id === value);
}
export function orderedPriorities(selected: readonly Priority[]): Priority[] {
  return PRIORITIES.filter((p) => selected.includes(p.id)).map((p) => p.id);
}
export function primaryAssessment(
  selected: readonly Priority[],
): PublicReportCardAssessmentType {
  // One parent lead owns contact matching and follow-up, regardless of review count.
  return (
    (orderedPriorities(selected).find((p) => p !== "lifestyle") as
      | PublicReportCardAssessmentType
      | undefined) ?? "family"
  );
}
export function isCombined(raw: unknown): raw is CombinedAnswers {
  return (
    !!raw &&
    typeof raw === "object" &&
    (raw as { format?: unknown }).format === COMBINED_FORMAT
  );
}

/** Explicit semantic equivalence only. Never infer equivalence from a field name. */
function canonicalKey(type: Priority, id: string): string {
  if (
    id === "age" &&
    ["family", "protection", "retirement", "tsp"].includes(type)
  )
    return "person.age";
  if (id === "housing" && ["family", "protection"].includes(type))
    return "household.monthly_housing";
  if (id === "state" && ["health", "protection"].includes(type))
    return "person.residence_state";
  if (id === "coverage" && ["family", "protection"].includes(type))
    return "person.life_coverage";
  if (id === "documents" && ["family", "retirement"].includes(type))
    return "household.estate_documents";
  if (id === "credit_range" && ["credit", "home_buyer"].includes(type))
    return "person.credit_range";
  return `${type}.${id}`;
}
function shortType(type: Priority): LegacyPublicReportCardAssessmentType {
  return type as LegacyPublicReportCardAssessmentType;
}
function originalQuestions(
  type: Priority,
): readonly (ShortQuestion | Question)[] {
  return type === "lifestyle"
    ? lifestyleQuestions
    : guidedTypes.has(type)
      ? SPECIALTY_CARDS[type as NewSpecialty].questions
      : SHORT_CARDS[shortType(type)].questions;
}
function projectedValue(
  type: Priority,
  id: string,
  answers: ShortDiagnostic,
): string | string[] | undefined {
  const value = answers[canonicalKey(type, id)];
  // The checkbox UI stores an exclusive unknown selection as an array. Guided
  // validators use the scalar sentinel; preserve that contract at the boundary.
  if (
    guidedTypes.has(type) &&
    Array.isArray(value) &&
    value.length === 1 &&
    value[0] === "unknown"
  )
    return "unknown";
  // Credit keeps the finer bands; homebuyer's existing scoring retains its own bands.
  return type === "home_buyer" &&
    id === "credit_range" &&
    ["620_659", "660_699"].includes(String(value))
    ? "620_699"
    : value;
}
export function projectDiagnostic(
  type: Priority,
  answers: ShortDiagnostic,
): Answers {
  const projected = Object.fromEntries(
    originalQuestions(type).flatMap((q) => {
      const value = projectedValue(type, q.id, answers);
      return value === undefined ? [] : [[q.id, value]];
    }),
  );
  const active =
    type === "lifestyle"
      ? visibleLifestyleQuestions(projected)
      : guidedTypes.has(type)
        ? guidedVisible(type as NewSpecialty, projected)
        : shortVisible(shortType(type), projected);
  return Object.fromEntries(
    active.flatMap((q) =>
      projected[q.id] === undefined ? [] : [[q.id, projected[q.id]]],
    ),
  );
}
function normalizedQuestion(
  type: Priority,
  original: ShortQuestion | Question,
): ShortQuestion {
  if (canonicalKey(type, original.id) === "person.residence_state")
    return SHORT_CARDS.protection.questions.find((q) => q.id === "state")!;
  if (canonicalKey(type, original.id) === "person.credit_range")
    return SHORT_CARDS.credit.questions.find((q) => q.id === "credit_range")!;
  if (!guidedTypes.has(type)) return original as ShortQuestion;
  const q = original as Question;
  const label =
    q.id === "state" && type === "benefits"
      ? c(
          "In which state does your business primarily operate?",
          "¿En qué estado opera principalmente tu negocio?",
        )
      : q.id === "state" && type === "tax"
        ? c(
            "Which state is relevant to this tax review?",
            "¿Qué estado corresponde a esta revisión fiscal?",
          )
        : q.label;
  return {
    id: q.id,
    label,
    kind: q.kind === "choice" ? "select" : q.kind,
    max: q.max,
    helper: q.help,
    options: q.options
      ?.map(([value, en, es]) => ({ value, label: c(en, es) }))
      .concat([{ value: "unknown", label: c("Not sure", "No sé") }]),
  };
}
export function combinedQuestions(
  selected: readonly Priority[],
  answers: ShortDiagnostic,
): CombinedQuestion[] {
  const out = new Map<string, CombinedQuestion>();
  for (const type of orderedPriorities(selected)) {
    const diagnostic = projectDiagnostic(type, answers);
    const active =
      type === "lifestyle"
        ? visibleLifestyleQuestions(diagnostic)
        : guidedTypes.has(type)
          ? guidedVisible(type as NewSpecialty, diagnostic)
          : shortVisible(shortType(type), diagnostic);
    for (const q of active) {
      const id = canonicalKey(type, q.id);
      const existing = out.get(id);
      if (existing) existing.reviews.push(type);
      else
        out.set(id, {
          id,
          question: normalizedQuestion(type, q),
          reviews: [type],
        });
    }
  }
  return [...out.values()];
}
export function validCombinedQuestion(
  item: CombinedQuestion,
  value: unknown,
): boolean {
  if (typeof value !== "string" && !Array.isArray(value)) return false;
  return item.reviews.every((type) => {
    const source = originalQuestions(type).find(
      (q) => canonicalKey(type, q.id) === item.id,
    )!;
    const translated = projectedValue(type, source.id, {
      [item.id]: value as string | string[],
    });
    return guidedTypes.has(type)
      ? guidedValid(source as Question, translated)
      : validQuestion(source as ShortQuestion, translated);
  });
}
/** Prune to a fixed point: a hidden parent cannot leave a visible stale descendant. */
export function pruneCombined(
  selected: readonly Priority[],
  answers: ShortDiagnostic,
): ShortDiagnostic {
  let next = { ...answers };
  for (let pass = 0; pass <= Object.keys(answers).length; pass++) {
    const active = new Set(combinedQuestions(selected, next).map((q) => q.id));
    const pruned = Object.fromEntries(
      Object.entries(next).filter(([key]) => active.has(key)),
    );
    if (Object.keys(pruned).length === Object.keys(next).length) return pruned;
    next = pruned;
  }
  return next;
}
export function updateCombined(
  selected: readonly Priority[],
  answers: ShortDiagnostic,
  id: string,
  value: string | string[],
): ShortDiagnostic {
  return pruneCombined(selected, { ...answers, [id]: value });
}
export function validateCombined(
  raw: unknown,
  assessmentType?: PublicReportCardAssessmentType,
): CombinedAnswers | null {
  if (
    !isCombined(raw) ||
    Object.keys(raw).some(
      (k) =>
        !["format", "selected", "diagnostic", "contact", "locale", "consultationOnly"].includes(k),
    )
  )
    return null;
  if (
    !Array.isArray(raw.selected) ||
    !raw.selected.length ||
    raw.selected.length > PRIORITIES.length ||
    !raw.selected.every(isPriority) ||
    new Set(raw.selected).size !== raw.selected.length
  )
    return null;
  if (assessmentType && primaryAssessment(raw.selected) !== assessmentType)
    return null;
  if (
    !["en", "es"].includes(raw.locale) ||
    !raw.diagnostic ||
    typeof raw.diagnostic !== "object" ||
    Array.isArray(raw.diagnostic)
  )
    return null;
  if (raw.consultationOnly !== undefined && raw.consultationOnly !== true) return null;
  const active = raw.consultationOnly ? [] : combinedQuestions(raw.selected, raw.diagnostic);
  if (
    Object.keys(raw.diagnostic).some(
      (id) => !active.some((q) => q.id === id),
    ) ||
    active.some((q) => !validCombinedQuestion(q, raw.diagnostic[q.id]))
  )
    return null;
  // Original validators remain the final authority for every existing Report Card.
  for (const type of raw.consultationOnly ? [] : raw.selected) {
    if (type === "lifestyle") continue;
    const diagnostic = projectDiagnostic(type, raw.diagnostic);
    const valid = guidedTypes.has(type)
      ? validateGuidedReport(type, {
          format: "guided-report-v4",
          assessmentType: type,
          diagnostic,
          contact: raw.contact,
          locale: raw.locale,
        })
      : validateShortAnswers(shortType(type), {
          format: "short-form-v3",
          assessmentType: type,
          diagnostic,
          contact: raw.contact,
        });
    if (!valid) return null;
  }
  // Lifestyle-only assessments must pass the same contact validation as every card.
  if (
    !raw.contact ||
    typeof raw.contact !== "object" ||
    Array.isArray(raw.contact) ||
    Object.keys(raw.contact).some(
      (k) => !["fullName", "email", "phone"].includes(k),
    )
  )
    return null;
  if (
    !(["fullName", "email", "phone"] as const).every(
      (k) => typeof raw.contact[k] === "string",
    )
  )
    return null;
  if (!validShortContact(raw.contact) || !normalizePhone(raw.contact.phone))
    return null;
  return {
    ...raw,
    selected: orderedPriorities(raw.selected),
    diagnostic: { ...raw.diagnostic },
    contact: {
      fullName: raw.contact.fullName.trim(),
      email: raw.contact.email.trim(),
      phone: raw.contact.phone.trim(),
    },
  };
}

/** Stored assessments omit contact data; expose only known, validated question rows. */
export function readStoredCombined(
  raw: unknown,
): Pick<CombinedAnswers, "selected" | "diagnostic" | "locale"> | null {
  if (
    !isCombined(raw) ||
    !Array.isArray(raw.selected) ||
    !raw.selected.length ||
    !raw.selected.every(isPriority) ||
    new Set(raw.selected).size !== raw.selected.length
  )
    return null;
  if (
    !raw.diagnostic ||
    typeof raw.diagnostic !== "object" ||
    Array.isArray(raw.diagnostic)
  )
    return null;
  const questions = combinedQuestions(raw.selected, raw.diagnostic);
  if (
    Object.keys(raw.diagnostic).some(
      (id) => !questions.some((q) => q.id === id),
    ) ||
    questions.some((q) => !validCombinedQuestion(q, raw.diagnostic[q.id]))
  )
    return null;
  return {
    selected: orderedPriorities(raw.selected),
    diagnostic: raw.diagnostic,
    locale: raw.locale === "es" ? "es" : "en",
  };
}
export function combinedAnswerRows(raw: unknown, locale: Locale = "en") {
  const saved = readStoredCombined(raw);
  if (!saved) return [];
  return combinedQuestions(saved.selected, saved.diagnostic).map(
    ({ id, question }) => {
      const rawValue = saved.diagnostic[id];
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      return {
        id,
        label: question.label[locale],
        value: values
          .map((value) =>
            value === "unknown"
              ? locale === "es"
                ? "No sé"
                : "Not sure"
              : (question.options?.find((o) => o.value === value)?.label[
                  locale
                ] ?? String(value)),
          )
          .join(", "),
      };
    },
  );
}

export function combinedValidationIssue(
  selected: readonly Priority[],
  diagnostic: ShortDiagnostic,
): { id: string; message: { en: string; es: string } } | null {
  for (const type of orderedPriorities(selected)) {
    if (!["retirement", "benefits", "tax"].includes(type)) continue;
    const issue = guidedError(
      type as "retirement" | "benefits" | "tax",
      projectDiagnostic(type, diagnostic),
    );
    if (issue === "retirement_age")
      return {
        id: canonicalKey(type, "target_age"),
        message: c(
          "Your target retirement age cannot be earlier than your current age.",
          "La edad prevista de jubilación no puede ser menor que tu edad actual.",
        ),
      };
    if (issue === "counts")
      return {
        id: canonicalKey(type, "fulltime"),
        message: c(
          "Employees working 30+ hours cannot exceed your total employee count.",
          "Los empleados que trabajan 30+ horas no pueden superar el total de empleados.",
        ),
      };
    if (issue === "coverage_counts")
      return {
        id: canonicalKey(type, "covered"),
        message: c(
          "Covered full-time employees cannot exceed your full-time employee count.",
          "Los empleados de tiempo completo cubiertos no pueden superar el total de tiempo completo.",
        ),
      };
  }
  return null;
}

/** Read compatibility only. New submissions must still use validateCombined directly.
 * Supply unknown for newly introduced fields; never overwrite stored answers or grades.
 */
export function restoreStoredCombined(raw:unknown):CombinedAnswers|null {
 const current=validateCombined(raw)
 if(current)return current
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null
 const value=raw as Record<string,unknown>
 if(!Array.isArray(value.selected)||!value.selected.every(isPriority)||!value.diagnostic||typeof value.diagnostic!=='object'||Array.isArray(value.diagnostic))return null
 const diagnostic={...value.diagnostic as ShortDiagnostic}
 const added=new Set([
  ...['owner_status','employees','business_review','coverage_date','renewal_date','travel_access','cost_records','exposure_review'].map(id=>'health.'+id),
  ...['renewal_date','review_reason','participation_review','budget_review','service_owner','personal_review'].map(id=>'benefits.'+id),
 ])
 for(let pass=0;pass<4;pass++)for(const q of combinedQuestions(value.selected as Priority[],diagnostic))if(added.has(q.id)&&diagnostic[q.id]===undefined)diagnostic[q.id]='unknown'
 return validateCombined({...value,diagnostic})
}
