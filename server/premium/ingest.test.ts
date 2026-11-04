import { buildDiagnosticFromAssessmentRow } from "../../crm/intake/intakeFormatters";
import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestPublicReportCard } from "../ingest/familyReportCard/ingestFamilyReportCard";
import { validIngestRequestBodyFixture } from "../ingest/familyReportCard/testFixtures";
import { combinedFixture } from "./testFixtures";
import {
  COMBINED_VERSION,
  primaryAssessment,
} from "../../modules/reportCard/combined/engine";
import { mapPublicFamilyDiagnosticDetail } from "../../crm/households/assessments/diagnosticFormatters";
it("persists all selected reviews under one ingest, retaining source attribution and consent", async () => {
  const answers = combinedFixture([
    "family",
    "business",
    "health",
    "lifestyle",
  ]);
  const request = {
    ...validIngestRequestBodyFixture(),
    answers,
    assessmentType: primaryAssessment(answers.selected),
    assessmentVersion: COMBINED_VERSION,
  };
  const rpc = vi.fn(async (name: string) =>
    name === "ingest_public_report_card"
      ? {
          data: {
            created: true,
            lead_id: "lead-one",
            household_id: "household-one",
            member_id: "member-one",
            assessment_id: "assessment-one",
            match_status: "new_prospect",
            sheets_sync_status: "pending",
          },
          error: null,
        }
      : { data: null, error: null },
  );
  const sync = vi.fn().mockResolvedValue(null);
  const result = await ingestPublicReportCard(request, {
    admin: { rpc } as unknown as SupabaseClient,
    findCandidates: async () => [],
    runStudentLoanDryRun: sync,
    sheetsWriter: vi.fn().mockResolvedValue({ status: "skipped" }),
  });
  expect(result.ok).toBe(true);
  const calls = rpc.mock.calls.filter(
    ([name]) => name === "ingest_public_report_card",
  );
  expect(calls).toHaveLength(1);
  const payload = (
    calls[0] as unknown as [string, { p_payload: Record<string, unknown> }]
  )[1].p_payload;
  expect(payload.report_path).toBe("/assessment-results");
  expect(payload.overall_score).toBeNull();
  expect(payload.scoring_version).toBe(COMBINED_VERSION);
  const derived = payload.derived_metrics as {
    combinedReportResults: unknown[];
    selectedPriorities: string[];
  };
  expect(derived.combinedReportResults).toHaveLength(4);
  expect(derived.selectedPriorities).toEqual(answers.selected);
  expect(payload.consent_snapshot).toBeDefined();
  expect(payload.original_source_metadata).toBeDefined();
  expect(sync).not.toHaveBeenCalled();
  expect(payload.raw_payload).toHaveProperty("tacBookingManaged", true);
  expect(payload.answers).not.toHaveProperty("contact");
  const intakeSummary = buildDiagnosticFromAssessmentRow(
    {
      id: "assessment-one",
      assessment_type: "family",
      answers: payload.answers,
      derived_metrics: payload.derived_metrics,
      overall_score: null,
      overall_grade: null,
    },
    null,
    null,
    payload.top_priorities,
    "Family Report Card",
  );
  expect(intakeSummary?.productLabel).toBe("Valtoris Financial Assessment");
  expect(intakeSummary?.overallScore).toBeNull();
  const detail = mapPublicFamilyDiagnosticDetail(
    {
      id: "assessment-one",
      assessment_type: "family",
      capture_channel: "public_self_report",
      status: "completed",
      completed_at: "2026-10-20T18:00:00Z",
      scoring_version: COMBINED_VERSION,
      answers: payload.answers,
      derived_metrics: payload.derived_metrics,
      priorities: payload.top_priorities,
    },
    "household-one",
    null,
  );
  expect(detail?.productLabel).toBe("Valtoris Financial Assessment");
  expect(detail?.combinedReports).toHaveLength(4);
  expect(
    detail?.submittedAnswers.filter((row) => row.id === "shared.state"),
  ).toHaveLength(1);
});
