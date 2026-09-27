import { describe, it, expect } from "vitest";
import {
  paymentTotals,
  workflowState,
  type PaymentEvent,
  type WorkflowEvent,
} from "./paymentLegs";
const e = (patch: Partial<PaymentEvent>): PaymentEvent => ({
  id: "release",
  account_id: "a",
  payment_leg: "carrier_to_imo",
  event_type: "paid",
  amount_cents: 10000,
  reversed_event_id: null,
  transaction_date: "2026-09-27",
  reason: "Evidence",
  provider_reference: null,
  statement_identifier: null,
  ...patch,
});
describe("Experior release and agent receipt", () => {
  it("never adds carrier release to agent earnings", () =>
    expect(
      paymentTotals([
        e({}),
        e({ id: "agent", payment_leg: "imo_to_agent", amount_cents: 7000 }),
      ]),
    ).toEqual({
      released: 10000,
      paid: 7000,
      agentChargebacks: 0,
      carrierChargebacks: 0,
    }));
  it("a carrier chargeback leaves agent receipt unchanged", () =>
    expect(
      paymentTotals([
        e({}),
        e({ id: "charge", event_type: "chargeback", amount_cents: -2000 }),
        e({ id: "agent", payment_leg: "imo_to_agent", amount_cents: 7000 }),
      ]),
    ).toEqual({
      released: 8000,
      paid: 7000,
      agentChargebacks: 0,
      carrierChargebacks: -2000,
    }));
  it("a reversal removes only its referenced fact from effective totals", () =>
    expect(
      paymentTotals([
        e({}),
        e({ id: "agent", payment_leg: "imo_to_agent", amount_cents: 7000 }),
        e({
          id: "rev",
          event_type: "reversal",
          payment_leg: "imo_to_agent",
          amount_cents: -7000,
          reversed_event_id: "agent",
        }),
      ]).paid,
    ).toBe(0));
  it("eligibility and manual pending are independent of payment", () => {
    const w = (patch: Partial<WorkflowEvent>): WorkflowEvent => ({
      id: "1",
      account_id: "a",
      action: "eligible",
      effective_date: "2026-09-27",
      created_at: "2026-09-27T10:00:00Z",
      reason: "Review",
      pending_amount_cents: null,
      ...patch,
    });
    expect(
      workflowState([
        w({}),
        w({ id: "2", action: "pending_confirmed", pending_amount_cents: 500 }),
        w({
          id: "3",
          action: "eligibility_revoked",
          created_at: "2026-09-27T11:00:00Z",
        }),
      ]),
    ).toEqual({ eligible: false, pending: 500 });
  });
});
