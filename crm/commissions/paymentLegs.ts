export type PaymentLeg = "carrier_to_imo" | "imo_to_agent";
export type PaymentEvent = {
  id: string;
  account_id: string | null;
  payment_leg: PaymentLeg;
  event_type: string;
  amount_cents: number;
  reversed_event_id: string | null;
  transaction_date: string | null;
  reason: string;
  provider_reference: string | null;
  statement_identifier: string | null;
};
export type WorkflowEvent = {
  id: string;
  account_id: string;
  action: string;
  effective_date: string;
  pending_amount_cents: number | null;
  reason: string;
  created_at: string;
};
export function legLabel(leg: PaymentLeg) {
  return leg === "carrier_to_imo" ? "Released to Experior" : "Paid to agent";
}
export function paymentTotals(events: readonly PaymentEvent[]) {
  const reversed = new Set(
    events
      .filter((e) => e.event_type === "reversal")
      .map((e) => e.reversed_event_id),
  );
  const result = {
    released: 0,
    paid: 0,
    agentChargebacks: 0,
    carrierChargebacks: 0,
  };
  for (const e of events) {
    if (e.event_type === "reversal" || reversed.has(e.id)) continue;
    if (e.payment_leg === "carrier_to_imo") {
      result.released += Number(e.amount_cents);
      if (e.event_type === "chargeback")
        result.carrierChargebacks += Number(e.amount_cents);
    } else {
      result.paid += Number(e.amount_cents);
      if (e.event_type === "chargeback")
        result.agentChargebacks += Number(e.amount_cents);
    }
  }
  return result;
}
export function workflowState(events: readonly WorkflowEvent[]) {
  const sorted = [...events].sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  );
  const eligible = sorted.find((e) =>
    ["eligible", "eligibility_revoked"].includes(e.action),
  );
  const pending = sorted.find((e) =>
    ["pending_confirmed", "pending_cleared"].includes(e.action),
  );
  return {
    eligible: eligible?.action === "eligible",
    pending:
      pending?.action === "pending_confirmed"
        ? Number(pending.pending_amount_cents)
        : null,
  };
}
