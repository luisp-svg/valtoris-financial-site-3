import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { formatCents } from "../production/productionApi";
import { parsePositiveDollarCents } from "./commissionMoney";
import {
  legLabel,
  paymentTotals,
  workflowState,
  type PaymentEvent,
  type PaymentLeg,
  type WorkflowEvent,
} from "./paymentLegs";
import { useUnsavedChangesWarning } from "../production/useUnsavedChangesWarning";
import "./paymentLegs.css";

type Account = {
  id: string;
  advisor_id: string;
  allocation_id: string | null;
  service_allocation_id: string | null;
  expected_cents_pinned: number | null;
};
type Choice = {
  id: string;
  sourceId: string;
  kind: "policy" | "service";
  label: string;
};
const money = (n: number | null) =>
  n === null ? "Not reviewed" : formatCents(n);
const today = () => new Date().toLocaleDateString("en-CA");
const initial = () => ({
  action: "paid",
  leg: "imo_to_agent" as PaymentLeg,
  amount: "",
  decrease: false,
  date: today(),
  reason: "",
  evidence: "",
  provider: "",
  transaction: "",
  statement: "",
});

export default function PaymentLegWorkspace({
  owner,
  serviceId,
}: {
  owner: boolean;
  serviceId?: string;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowEvent[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [selection, setSelection] = useState("");
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [reverse, setReverse] = useState("");
  const [reverseReason, setReverseReason] = useState("");
  useUnsavedChangesWarning(editing || !!reverse);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const db = createSupabaseBrowserClient();
      // Page every collection: never silently total a truncated ledger.
      async function all(
        table: string,
        select: string,
        filter?: [string, string],
      ) {
        const rows: Record<string, unknown>[] = [];
        for (let page = 0; ; page++) {
          let q = db
            .from(table)
            .select(select)
            .order("id")
            .range(page * 500, page * 500 + 499);
          if (filter) q = q.eq(...filter);
          const r = await q;
          if (r.error) throw r.error;
          rows.push(...(r.data as unknown as Record<string, unknown>[]));
          if (r.data.length < 500) return rows;
        }
      }
      const [a, e, w, s, p] = await Promise.all([
        all(
          "policy_writing_commission_accounts",
          "*",
          serviceId ? ["service_record_id", serviceId] : undefined,
        ),
        all(
          "policy_writing_commission_events",
          "*",
          serviceId ? ["service_record_id", serviceId] : undefined,
        ),
        all("writing_commission_workflow_events", "*"),
        all(
          "service_production_allocations",
          "id,record_id,advisor_id,effective_to,advisor_profiles(display_name),service_production_records!inner(product_name,provider_name,deleted_at)",
          serviceId ? ["record_id", serviceId] : undefined,
        ),
        serviceId
          ? Promise.resolve([])
          : all(
              "policy_agent_allocations",
              "id,application_id,advisor_id,allocation_role,recipient_type,advisor_profiles(display_name),policy_applications!inner(application_number,product_line,deleted_at)",
            ),
      ]);
      const options: Choice[] = [];
      for (const row of [...s, ...p]) {
        const service = "record_id" in row;
        const source = (
          service ? row.service_production_records : row.policy_applications
        ) as Record<string, unknown>;
        const advisor = row.advisor_profiles as { display_name: string } | null;
        if (
          !source ||
          source.deleted_at ||
          (!service &&
            (row.allocation_role !== "writing" ||
              row.recipient_type !== "advisor"))
        )
          continue;
        options.push({
          id: String(row.id),
          sourceId: String(service ? row.record_id : row.application_id),
          kind: service ? "service" : "policy",
          label: `${service ? source.product_name + " · " + source.provider_name : source.application_number || source.product_line} · ${advisor?.display_name ?? "Writing advisor"}${row.effective_to ? " (previous allocation)" : ""}`,
        });
      }
      setAccounts(a as unknown as Account[]);
      setEvents(e as unknown as PaymentEvent[]);
      setWorkflow(w as unknown as WorkflowEvent[]);
      setChoices(options);
    } catch {
      setError(
        "Unable to load payment tracking. Refresh and try again. No totals are shown until all records load.",
      );
      setAccounts([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);
  useEffect(() => {
    void load();
  }, [load]);
  const choice = choices.find((c) => c.id === selection);
  const financial = ["paid", "adjustment", "chargeback", "recovery"].includes(
    form.action,
  );
  const selectedAccount = accounts.find(
    (a) => (a.allocation_id ?? a.service_allocation_id) === selection,
  );
  const shown = selection
    ? events.filter((e) => e.account_id === selectedAccount?.id)
    : events;
  const totals = paymentTotals(shown);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!choice || busy) return;
    setError("");
    setNotice("");
    const parsed = parsePositiveDollarCents(form.amount);
    if (
      (financial || form.action === "pending_confirmed") &&
      (!parsed.ok || parsed.cents > 999999999999)
    ) {
      setError("Enter a positive amount with at most two decimal places.");
      return;
    }
    const amount = parsed.ok
      ? parsed.cents *
        (form.action === "chargeback" ||
        (form.action === "adjustment" && form.decrease)
          ? -1
          : 1)
      : null;
    setBusy(true);
    try {
      const payload = {
        action: form.action,
        amount_cents:
          financial || form.action === "pending_confirmed" ? amount : null,
        effective_date: form.date,
        reason: form.reason,
        evidence_reference: form.evidence,
        idempotency_key: key,
        ...(financial
          ? {
              payment_leg: form.leg,
              provider_reference: form.provider,
              transaction_reference: form.transaction,
              statement_identifier: form.statement,
            }
          : {}),
      };
      const r = await createSupabaseBrowserClient().rpc(
        "record_commission_fact",
        {
          p_source_kind: choice.kind,
          p_source_id: choice.sourceId,
          p_allocation_id: choice.id,
          p_payload: payload,
        },
      );
      if (r.error) throw r.error;
      setNotice("Commission record saved.");
      setEditing(false);
      setForm(initial());
      setKey(crypto.randomUUID());
      await load();
    } catch {
      setError(
        "Record was not confirmed. Check the required evidence and date. A duplicate transaction or changed retry is rejected; refresh history before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reverseEvent(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await createSupabaseBrowserClient().rpc(
        "reverse_policy_writing_commission_event",
        {
          p_event_id: reverse,
          p_reason: reverseReason,
          p_idempotency_key: `reverse:${reverse}`,
        },
      );
      if (r.error) throw r.error;
      setReverse("");
      setReverseReason("");
      setNotice("Reversal saved. Original evidence remains in history.");
      await load();
    } catch {
      setError("Unable to confirm reversal. Refresh history before retrying.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="payment-legs" aria-label="Advisor payment tracking">
      <h2>Advisor payment tracking</h2>
      <p>
        <strong>Released</strong> means the carrier sent commissions to
        Experior. <strong>Paid</strong> means the agent received their
        commission. Each needs its own evidence.
      </p>
      {!owner && <p>Only your attributed compensation is shown.</p>}
      {error && (
        <p role="alert" className="crm-banner crm-banner-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {loading ? (
        <p role="status">Loading payment records…</p>
      ) : (
        <>
          <label>
            Writing allocation
            <select
              disabled={editing || busy || !!reverse}
              value={selection}
              onChange={(e) => setSelection(e.target.value)}
            >
              <option value="">All visible accounts</option>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {!error && (
            <dl className="payment-totals">
              <div>
                <dt>Net released to Experior</dt>
                <dd>{money(totals.released)}</dd>
              </div>
              <div>
                <dt>Net paid to agent</dt>
                <dd>{money(totals.paid)}</dd>
              </div>
              <div>
                <dt>Agent chargebacks</dt>
                <dd>{money(totals.agentChargebacks)}</dd>
              </div>
            </dl>
          )}
          {selectedAccount && (
            <p>
              Pinned expected: {money(selectedAccount.expected_cents_pinned)}.
              Eligibility:{" "}
              {workflowState(
                workflow.filter((w) => w.account_id === selectedAccount.id),
              ).eligible
                ? "Owner confirmed"
                : "Not confirmed"}
              . Manual service pending:{" "}
              {money(
                workflowState(
                  workflow.filter((w) => w.account_id === selectedAccount.id),
                ).pending,
              )}
              .
            </p>
          )}
          {owner && !editing && (
            <button
              type="button"
              disabled={!choice || busy || !!reverse}
              onClick={() => {
                setEditing(true);
                setError("");
                setNotice("");
                setForm(initial());
                setKey(crypto.randomUUID());
              }}
            >
              Record commission fact
            </button>
          )}
          {owner && !choice && (
            <p>
              Select a writing allocation to record a payment or eligibility
              decision. Policy carrier releases use the carrier ledger below;
              policy pending uses the pending import review.
            </p>
          )}
          {editing && choice && (
            <form onSubmit={save}>
              <fieldset disabled={busy}>
                <legend>Record for {choice.label}</legend>
                <label>
                  Fact
                  <select
                    value={form.action}
                    onChange={(e) =>
                      setForm({ ...form, action: e.target.value })
                    }
                  >
                    <option value="paid">Payment received</option>
                    <option value="chargeback">Chargeback</option>
                    <option value="adjustment">Adjustment</option>
                    <option value="recovery">Recovery</option>
                    <option value="eligible">Confirm eligible</option>
                    <option value="eligibility_revoked">
                      Revoke eligibility
                    </option>
                    {choice.kind === "service" && (
                      <>
                        <option value="pending_confirmed">
                          Confirm pending
                        </option>
                        <option value="pending_cleared">Clear pending</option>
                      </>
                    )}
                  </select>
                </label>
                {financial && (
                  <label>
                    Payment step
                    <select
                      value={form.leg}
                      onChange={(e) =>
                        setForm({ ...form, leg: e.target.value as PaymentLeg })
                      }
                    >
                      {choice.kind === "service" && (
                        <option value="carrier_to_imo">
                          Released — carrier to Experior
                        </option>
                      )}
                      <option value="imo_to_agent">
                        Paid — received by agent
                      </option>
                    </select>
                  </label>
                )}
                {(financial || form.action === "pending_confirmed") && (
                  <label>
                    Amount in USD
                    <input
                      required
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(e) =>
                        setForm({ ...form, amount: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </label>
                )}
                {form.action === "adjustment" && (
                  <label>
                    <input
                      type="checkbox"
                      checked={form.decrease}
                      onChange={(e) =>
                        setForm({ ...form, decrease: e.target.checked })
                      }
                    />
                    Decrease this payment step
                  </label>
                )}
                <label>
                  {financial
                    ? "Date received / adjustment date"
                    : "Effective date"}
                  <input
                    required
                    type="text"
                    placeholder="YYYY-MM-DD"
                    pattern="\d{4}-\d{2}-\d{2}"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </label>
                {financial && (
                  <>
                    <label>
                      Carrier / provider identifier
                      <input
                        required
                        maxLength={200}
                        value={form.provider}
                        onChange={(e) =>
                          setForm({ ...form, provider: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Statement reference
                      <input
                        required
                        maxLength={200}
                        value={form.statement}
                        onChange={(e) =>
                          setForm({ ...form, statement: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Transaction reference
                      <input
                        required
                        maxLength={200}
                        value={form.transaction}
                        onChange={(e) =>
                          setForm({ ...form, transaction: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                <label>
                  Evidence reference
                  <input
                    required
                    maxLength={200}
                    value={form.evidence}
                    onChange={(e) =>
                      setForm({ ...form, evidence: e.target.value })
                    }
                  />
                </label>
                <label>
                  Reason
                  <textarea
                    required
                    maxLength={500}
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                  />
                </label>
                <p>
                  {financial
                    ? `Confirm the evidence supports ${legLabel(form.leg).toLowerCase()}. This will not record the other payment step.`
                    : "This decision does not post money or change production status."}
                </p>
                <button type="submit">
                  {busy ? "Saving…" : "Save confirmed fact"}
                </button>{" "}
                <button type="button" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </fieldset>
            </form>
          )}
          <h3>Financial history</h3>
          {!shown.length && <p>No financial events recorded.</p>}
          <div className="payment-history">
            {shown.map((e) => (
              <article key={e.id}>
                <p>
                  {choices.find((c) => {
                    const a = accounts.find((a) => a.id === e.account_id);
                    return (
                      c.id === (a?.allocation_id ?? a?.service_allocation_id)
                    );
                  })?.label ?? "Historical / unattributed account"}
                </p>
                <strong>
                  {legLabel(e.payment_leg)} ·{" "}
                  {e.event_type === "paid" ? "Payment" : e.event_type}
                </strong>
                <p>
                  {money(Number(e.amount_cents))} ·{" "}
                  {e.transaction_date?.slice(0, 10) ?? "Date not recorded"}
                </p>
                <p>{e.reason}</p>
                {shown.some((r) => r.reversed_event_id === e.id) && (
                  <p>Reversed — original retained</p>
                )}
                {owner &&
                  e.event_type !== "reversal" &&
                  !shown.some((r) => r.reversed_event_id === e.id) && (
                    <button
                      type="button"
                      disabled={busy || editing || !!reverse}
                      onClick={() => setReverse(e.id)}
                    >
                      Reverse this entry
                    </button>
                  )}
              </article>
            ))}
          </div>
          {reverse && (
            <form onSubmit={reverseEvent}>
              <label>
                Reason for reversal
                <textarea
                  required
                  maxLength={500}
                  disabled={busy}
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                />
              </label>
              <button disabled={busy} type="submit">
                Confirm reversal
              </button>{" "}
              <button
                disabled={busy}
                type="button"
                onClick={() => setReverse("")}
              >
                Cancel
              </button>
            </form>
          )}
          <h3>Workflow history</h3>
          {workflow
            .filter(
              (w) =>
                accounts.some((a) => a.id === w.account_id) &&
                (!selection || w.account_id === selectedAccount?.id),
            )
            .map((w) => (
              <p key={w.id}>
                {w.effective_date.slice(0, 10)} · {w.action.replace(/_/g, " ")}{" "}
                · {w.reason}
              </p>
            ))}
        </>
      )}
    </section>
  );
}
