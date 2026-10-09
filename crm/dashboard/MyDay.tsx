import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { useCrmAuth } from "../auth/CrmAuthContext";
import { fetchVisibleTasks, localDateString } from "../tasks/tasksApi";
import { fetchProductionApplications } from "../production/productionApi";
import type { WorkItem } from "../operations/model";
import { crmProductionPath } from "../../constants/routes";
type Entry = {
  id: string;
  title: string;
  due: string | null;
  path: string;
  source: string;
  priority: string;
};
export default function MyDay() {
  const { profile } = useCrmAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!profile) return;
    const db = createSupabaseBrowserClient(),
      today = localDateString();
    const sources = await Promise.allSettled([
      fetchVisibleTasks(db, { assignedUserId: profile.id }),
      db
        .from("operations_items")
        .select("*")
        .eq("assigned_user_id", profile.id)
        .not("status", "in", "(done,cancelled)")
        .order("due_date", { nullsFirst: false }),
      fetchProductionApplications(db, { followUpThrough: today }),
    ]);
    const rows: Entry[] = [],
      issues: string[] = [];
    const tasks = sources[0];
    if (tasks.status === "fulfilled")
      rows.push(
        ...tasks.value.map((t) => ({
          id: t.id,
          title: t.title,
          due: t.due_date,
          path: `/crm/tasks?task=${t.id}`,
          source: "Client task",
          priority: t.priority,
        })),
      );
    else issues.push("Client tasks unavailable.");
    const work = sources[1];
    if (work.status === "fulfilled" && !work.value.error)
      rows.push(
        ...((work.value.data ?? []) as WorkItem[]).map((t) => ({
          id: t.id,
          title: t.title,
          due: t.due_date,
          path: `/crm/operations?workspace=${t.workspace_id}&item=${t.id}`,
          source: "Operations",
          priority: t.priority,
        })),
      );
    else issues.push("Operations work unavailable.");
    const cases = sources[2];
    if (cases.status === "fulfilled")
      rows.push(
        ...cases.value.map((t) => ({
          id: t.id,
          title: `Follow up: ${t.household?.display_name || t.application_number || "Production case"}`,
          due: t.next_follow_up_date,
          path: crmProductionPath(t.id),
          source: "Production · visible cases",
          priority: "high",
        })),
      );
    else issues.push("Production follow-ups unavailable.");
    rows.sort(
      (a, b) =>
        (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
        ({ urgent: 0, high: 1, medium: 2, low: 3 }[a.priority as "urgent"] ??
          2) -
          ({ urgent: 0, high: 1, medium: 2, low: 3 }[b.priority as "urgent"] ??
            2),
    );
    setEntries(rows);
    setErrors(issues);
    setLoading(false);
  }, [profile]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [load]);
  const today = localDateString(),
    due = entries.filter((e) => e.due && e.due <= today),
    next = entries.filter((e) => !e.due || e.due > today);
  return (
    <section className="crm-panel" aria-label="My Day">
      <div className="crm-panel-head">
        <div>
          <p className="crm-page-eyebrow">Your daily work</p>
          <h2>My Day</h2>
        </div>
        <button className="crm-text-btn" onClick={() => void load()}>
          Refresh My Day
        </button>
      </div>
      <p className="crm-muted">
        Your client tasks and Operations assignments, plus production follow-ups
        visible under your CRM permissions.
      </p>
      {errors.map((e) => (
        <p key={e} role="alert">
          {e}
        </p>
      ))}
      {loading ? (
        <p>Loading daily work…</p>
      ) : (
        <>
          <h3>Due today / overdue · {due.length}</h3>
          {!due.length && <p>No work due today.</p>}
          <ul className="crm-task-list">
            {due.map((e) => (
              <li key={e.source + e.id} className="crm-task-row">
                <div>
                  <Link to={e.path}>{e.title}</Link>
                  <p className="crm-muted">
                    {e.source} · {e.due} ·{" "}
                    {e.due! < today ? "Overdue" : "Due today"} · {e.priority}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <details>
            <summary>Upcoming / no deadline · {next.length}</summary>
            <ul className="crm-task-list">
              {next.map((e) => (
                <li key={e.source + e.id}>
                  <Link to={e.path}>{e.title}</Link>
                  <p className="crm-muted">
                    {e.source} · {e.due || "Set a deadline"}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
