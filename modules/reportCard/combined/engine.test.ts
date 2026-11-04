
import { SPECIALTY_CARDS } from "../specialtyPreview/catalog";
import { describe, expect, it } from "vitest";
import {
  COMBINED_FORMAT,
  PRIORITIES,
  combinedQuestions,
  primaryAssessment,
  projectDiagnostic,
  pruneCombined,
  updateCombined,
  validCombinedQuestion,
  validateCombined,
  type Priority,
} from "./legacyEngine";
import type { ShortDiagnostic } from "../shortForm/contract";

const contact = {
  fullName: "Preview Visitor",
  email: "preview@example.com",
  phone: "+1 202-555-0100",
};
function completed(selected: Priority[]) {
  let diagnostic: ShortDiagnostic = {};
  for (let pass = 0; pass < 8; pass++) {
    for (const q of combinedQuestions(selected, diagnostic)) {
      if (diagnostic[q.id] !== undefined) continue;
      diagnostic[q.id] = validCombinedQuestion(q, "unknown")
        ? "unknown"
        : q.question.kind === "number"
          ? "1"
          : q.question.kind === "multi"
            ? ["unknown"]
            : q.question.options![0].value;
    }
    diagnostic = pruneCombined(selected, diagnostic);
  }
  return {
    format: COMBINED_FORMAT,
    selected,
    diagnostic,
    contact,
    locale: "en" as const,
  };
}
describe("combined financial priorities", () => {
  it("deduplicates person age, life coverage and estate documents while retaining distinct financial subjects", () => {
    const selected: Priority[] = [
      "family",
      "business",
      "retirement",
      "protection",
      "tsp",
    ];
    const questions = combinedQuestions(selected, {});
    expect(questions.filter((q) => q.id === "person.age")).toHaveLength(1);
    expect(questions.find((q) => q.id === "person.age")?.reviews).toHaveLength(
      4,
    );
    expect(
      questions.filter((q) => q.id === "person.life_coverage"),
    ).toHaveLength(1);
    expect(
      questions.filter((q) => q.id === "household.estate_documents"),
    ).toHaveLength(1);
    expect(questions.map((q) => q.id)).toEqual(
      expect.arrayContaining([
        "family.income",
        "business.revenue",
        "retirement.income",
        "protection.income",
        "family.reserves",
        "business.reserves",
      ]),
    );
  });
  it("maps a single finer credit range to the original homebuyer band without changing credit", () => {
    const answers = { "person.credit_range": "660_699" };
    expect(projectDiagnostic("credit", answers).credit_range).toBe("660_699");
    expect(projectDiagnostic("home_buyer", answers).credit_range).toBe(
      "620_699",
    );
    expect(
      combinedQuestions(["home_buyer", "credit"], {}).filter(
        (q) => q.id === "person.credit_range",
      ),
    ).toHaveLength(1);
  });
  it("removes stale conditional answers and deselected review answers", () => {
    const selected: Priority[] = ["health", "family"];
    let diagnostic = updateCombined(
      selected,
      {},
      "health.purpose",
      "supplemental",
    );
    diagnostic = updateCombined(selected, diagnostic, "health.supplement", [
      "dental",
    ]);
    expect(diagnostic["health.supplement"]).toEqual(["dental"]);
    diagnostic = updateCombined(
      selected,
      diagnostic,
      "health.purpose",
      "individual",
    );
    expect(diagnostic["health.supplement"]).toBeUndefined();
    diagnostic["person.age"] = "45";
    expect(pruneCombined(["family"], diagnostic)).toEqual({
      "person.age": "45",
    });
  });
  it("retains zero and unknown as distinct values", () => {
    expect(
      updateCombined(["family"], {}, "person.life_coverage", "0")[
        "person.life_coverage"
      ],
    ).toBe("0");
    expect(
      updateCombined(["family"], {}, "person.life_coverage", "unknown")[
        "person.life_coverage"
      ],
    ).toBe("unknown");
  });
  it("keeps one deterministic parent and validates every nonempty priority combination", () => {
    for (let mask = 1; mask < 2 ** PRIORITIES.length; mask++) {
      const selected = PRIORITIES.filter((_, bit) => mask & (1 << bit)).map(
        (p) => p.id,
      );
      const answers = completed(selected);
      const questions = combinedQuestions(selected, answers.diagnostic);
      expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
      expect(
        validateCombined(answers, primaryAssessment(selected)),
        selected.join(","),
      ).not.toBeNull();
      expect(primaryAssessment([...selected].reverse())).toBe(
        primaryAssessment(selected),
      );
    }
  }, 20_000);
  it("rejects hidden fields, duplicate priorities, invalid contact details and spoofed parent types", () => {
    const answers = completed(["lifestyle"]);
    expect(
      validateCombined({
        ...answers,
        diagnostic: { ...answers.diagnostic, "health.goal": "access" },
      }),
    ).toBeNull();
    expect(
      validateCombined({ ...answers, selected: ["lifestyle", "lifestyle"] }),
    ).toBeNull();
    expect(
      validateCombined({ ...answers, contact: { ...contact, email: "bad" } }),
    ).toBeNull();
    expect(validateCombined(answers, "health")).toBeNull();
    expect(
      validateCombined({ ...answers, contact: { ...contact, phone: "bad" } }),
    ).toBeNull();
  });
});

it("accepts the TSP multi-select unknown checkbox and projects the original guided sentinel", () => {
  const data = completed(["tsp"]);
  const goal = SPECIALTY_CARDS.tsp.questions
    .find((q) => q.id === "goal")!
    .options!.find(
      ([, label]) => label === "Coordinate retirement income and benefits",
    )![0];
  data.diagnostic = {
    ...data.diagnostic,
    "tsp.goal": goal,
    "tsp.service": "civilian",
  };
  for (let pass = 0; pass < 8; pass++) {
    data.diagnostic = pruneCombined(data.selected, data.diagnostic);
    for (const q of combinedQuestions(data.selected, data.diagnostic)) {
      if (data.diagnostic[q.id] === undefined)
        data.diagnostic[q.id] =
          q.question.kind === "multi" ? ["unknown"] : "unknown";
    }
  }
  const q = combinedQuestions(data.selected, data.diagnostic).find(
    (q) => q.id === "tsp.income_sources",
  )!;
  expect(q).toBeDefined();
  expect(validCombinedQuestion(q, ["unknown"])).toBe(true);
  expect(validCombinedQuestion(q, ["unknown", "pension"])).toBe(false);
  expect(projectDiagnostic("tsp", data.diagnostic).income_sources).toBe(
    "unknown",
  );
  expect(validateCombined(data)).not.toBeNull();
});

it('accepts immediate student-loan reviews and a general credit-score goal',()=>{
 for(const [priority,field,value] of [['student_loan','timing','immediately'],['credit','priority','improve_score']] as const){
  const answers=completed([priority]);const question=combinedQuestions([priority],answers.diagnostic).find(q=>q.id.endsWith('.'+field))!;
  expect(question).toBeDefined();answers.diagnostic[question.id]=value;expect(validateCombined(answers)).not.toBeNull();
 }
})
