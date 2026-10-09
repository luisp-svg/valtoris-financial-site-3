import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { useCrmAuth } from "../../crm/auth/CrmAuthContext";
import {
  fetchAssigneeOptions,
  fetchVisibleTasks,
  localDateString,
} from "../../crm/tasks/tasksApi";
import type { AssigneeOption, CrmTask } from "../../crm/tasks/types";
import {
  STATUSES,
  statusLabel,
  summarizeWork,
  type WorkItem,
  type WorkStatus,
} from "../../crm/operations/model";
import "../../crm/operations/operations.css";

type Workspace = { id: string; name: string; owner_user_id: string };
const emptyForm = {
  title: "",
  description: "",
  division: "Operations",
  kind: "project" as "project" | "task",
  parent_id: "",
  assigned_user_id: "",
  due_date: "",
  priority: "medium",
  blocker: "",
};
const message = (error: unknown) =>
  error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "Unable to save. Please try again.";

export default function CrmOperationsPage() {
  const { profile, role } = useCrmAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [items, setItems] = useState<WorkItem[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [people, setPeople] = useState<AssigneeOption[]>([]);
  const [clientTasks, setClientTasks] = useState<CrmTask[]>([]);
  const [clientError, setClientError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WorkItem | null>(null);
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [newMember, setNewMember] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Valtoris Operations");
  const generation = useRef(0);
  const requestId = useRef(crypto.randomUUID());
  const workspace = workspaces.find((w) => w.id === workspaceId);
  const ownsWorkspace = workspace?.owner_user_id === profile?.id;
  const load = useCallback(async () => {
    if (!profile || !role) return;
    const current = ++generation.current;
    setLoading(true);
    try {
      const db = createSupabaseBrowserClient();
      const [spaces, roster, tasks] = await Promise.allSettled([
        db
          .from("operations_workspaces")
          .select("id,name,owner_user_id")
          .order("created_at"),
        fetchAssigneeOptions(db, role, profile.id),
        fetchVisibleTasks(db, { assignedUserId: profile.id }),
      ]);
      if (current !== generation.current) return;
      if (tasks.status === "fulfilled") {
        setClientTasks(tasks.value);
        setClientError("");
      } else {
        setClientTasks([]);
        setClientError(message(tasks.reason));
      }
      if (roster.status === "fulfilled") setPeople(roster.value);
      else throw roster.reason;
      if (spaces.status === "rejected") throw spaces.reason;
      if (spaces.value.error) throw spaces.value.error;
      const list = (spaces.value.data ?? []) as Workspace[];
      setWorkspaces(list);
      if (!workspaceId && list.length) {
        setWorkspaceId(list[0].id);
        return;
      }
      if (workspaceId) {
        const [work, team] = await Promise.all([
          db
            .from("operations_items")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("due_date", { nullsFirst: false }),
          db
            .from("operations_members")
            .select("user_id")
            .eq("workspace_id", workspaceId),
        ]);
        if (current !== generation.current) return;
        if (work.error) throw work.error;
        if (team.error) throw team.error;
        setItems((work.data ?? []) as WorkItem[]);
        setMembers((team.data ?? []).map((m) => String(m.user_id)));
      } else {
        setItems([]);
        setMembers([]);
      }
      setError("");
    } catch (e) {
      if (current === generation.current) {
        setItems([]);
        setMembers([]);
        setError(
          e &&
            typeof e === "object" &&
            "code" in e &&
            ["42P01", "PGRST205"].includes(String(e.code))
            ? "Operations is awaiting setup in this environment. Your client follow-ups remain available below."
            : message(e),
        );
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [profile, role, workspaceId]);
  useEffect(() => {
    const counter = generation;
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30000);
    return () => {
      clearInterval(timer);
      counter.current++;
    };
  }, [load]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function createWorkspace(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const result = await createSupabaseBrowserClient()
        .from("operations_workspaces")
        .insert({ name: workspaceName.trim(), owner_user_id: profile!.id })
        .select("id")
        .single();
      if (result.error) throw result.error;
      setWorkspaceId(result.data.id);
    });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const db = createSupabaseBrowserClient();
      const values = {
        title: form.title.trim(),
        description: form.description,
        division: form.division,
        priority: form.priority,
        blocker: form.blocker,
        assigned_user_id: form.assigned_user_id || null,
        due_date: form.due_date || null,
      };
      if (editing) {
        const result = await db
          .from("operations_items")
          .update(values)
          .eq("id", editing.id)
          .eq("workspace_id", workspaceId)
          .eq("updated_at", editing.updated_at)
          .select("id");
        if (result.error) throw result.error;
        if (!result.data?.length)
          throw new Error("This item changed. Refresh and try again.");
      } else {
        const result = await db.from("operations_items").upsert(
          {
            ...values,
            id: requestId.current,
            workspace_id: workspaceId,
            kind: form.kind,
            parent_id: form.kind === "task" ? form.parent_id || null : null,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
        if (result.error) throw result.error;
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      requestId.current = crypto.randomUUID();
    });
  }
  const stats = summarizeWork(items, localDateString(), profile?.id ?? "");
  const visible = items.filter(
    (i) =>
      (view !== "mine" || i.assigned_user_id === profile?.id) &&
      (view !== "roadmap" || i.division === "CRM Roadmap") &&
      (view !== "projects" || i.kind === "project") &&
      (view !== "blocked" || i.blocker.trim()) &&
      `${i.title} ${i.description} ${i.division}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const nameFor = (id: string | null) =>
    people.find((p) => p.id === id)?.full_name ||
    (id === profile?.id
      ? profile.full_name
      : id
        ? "Team member"
        : "Unassigned");
  return (
    <div className="operations-page">
      <header className="crm-page-header">
        <div>
          <p className="crm-page-eyebrow">Agency operations</p>
          <h1 className="crm-page-title">Operations</h1>
          <p className="crm-page-subtitle">
            Projects, the CRM roadmap, and your client follow-ups in one place.
          </p>
        </div>
        <button
          className="crm-text-btn"
          disabled={busy || loading}
          onClick={() => void load()}
        >
          Refresh
        </button>
      </header>
      {error && (
        <p role="alert" className="crm-banner crm-banner-error">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="crm-muted">
          Refreshing dashboard…
        </p>
      )}
      {!loading && !error && !workspaces.length && (
        <section className="crm-panel">
          <h2>Start your Operations workspace</h2>
          <p>
            Workspace members can see its projects. Client access continues to
            follow existing CRM permissions.
          </p>
          {role === "owner" ? (
            <form onSubmit={createWorkspace}>
              <label className="crm-field">
                Workspace name
                <input
                  required
                  maxLength={120}
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                />
              </label>
              <button className="crm-primary-btn" disabled={busy}>
                Create workspace
              </button>
            </form>
          ) : (
            <p>Ask your workspace owner to add you to Operations.</p>
          )}
        </section>
      )}
      {!!workspaces.length && (
        <>
          <div className="operations-toolbar">
            <label className="crm-field">
              Workspace
              <select
                value={workspaceId}
                disabled={busy}
                onChange={(e) => {
                  setItems([]);
                  setMembers([]);
                  setShowForm(false);
                  setWorkspaceId(e.target.value);
                }}
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="crm-field">
              Search work
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a project or task"
              />
            </label>
            {ownsWorkspace && (
              <button
                className="crm-primary-btn"
                disabled={busy || loading}
                onClick={() => {
                  setEditing(null);
                  setForm(emptyForm);
                  requestId.current = crypto.randomUUID();
                  setShowForm(true);
                }}
              >
                Add work
              </button>
            )}
          </div>
          <div className="operations-stats">
            {[
              ["Active projects", stats.projects],
              ["Overdue work", stats.overdue],
              ["Blocked", stats.blocked],
              ["Assigned to me", stats.mine],
            ].map(([label, value]) => (
              <section className="crm-panel" key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </section>
            ))}
          </div>
          {ownsWorkspace && (
            <details className="crm-panel">
              <summary>Workspace team ({members.length})</summary>
              <p>
                {members.map(nameFor).join(", ") ||
                  "No members yet. Add yourself and the people working on these projects."}
              </p>
              <form
                className="operations-toolbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const result = await createSupabaseBrowserClient()
                      .from("operations_members")
                      .insert({
                        workspace_id: workspaceId,
                        user_id: newMember,
                      });
                    if (result.error) throw result.error;
                    setNewMember("");
                  });
                }}
              >
                <label className="crm-field">
                  Add existing CRM user
                  <select
                    required
                    value={newMember}
                    onChange={(e) => setNewMember(e.target.value)}
                  >
                    <option value="">Choose a person</option>
                    {people
                      .filter((p) => !members.includes(p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name || p.email}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="crm-primary-btn"
                  disabled={busy || !newMember}
                >
                  Add member
                </button>
              </form>
            </details>
          )}
          {showForm && ownsWorkspace && (
            <section className="crm-panel">
              <h2>{editing ? "Edit work" : "Add project or task"}</h2>
              <form onSubmit={save} className="crm-task-form">
                <label className="crm-field">
                  Title
                  <input
                    required
                    maxLength={200}
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                  />
                </label>
                <div className="crm-form-grid">
                  <label className="crm-field">
                    Type
                    <select
                      disabled={!!editing}
                      value={form.kind}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          kind: e.target.value as "project" | "task",
                        })
                      }
                    >
                      <option value="project">Project</option>
                      <option value="task">Task</option>
                    </select>
                  </label>
                  <label className="crm-field">
                    Division
                    <select
                      value={form.division}
                      onChange={(e) =>
                        setForm({ ...form, division: e.target.value })
                      }
                    >
                      {[
                        "Operations",
                        "CRM Roadmap",
                        "Health",
                        "P&C",
                        "Life & Annuities",
                        "Student Loans",
                        "Credit Repair",
                        "Lead Revival",
                        "Marketing",
                      ].map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    Owner
                    <select
                      value={form.assigned_user_id}
                      onChange={(e) =>
                        setForm({ ...form, assigned_user_id: e.target.value })
                      }
                    >
                      <option value="">Unassigned</option>
                      {members.map((id) => (
                        <option key={id} value={id}>
                          {nameFor(id)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    Due date
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) =>
                        setForm({ ...form, due_date: e.target.value })
                      }
                    />
                  </label>
                  <label className="crm-field">
                    Priority
                    <select
                      value={form.priority}
                      onChange={(e) =>
                        setForm({ ...form, priority: e.target.value })
                      }
                    >
                      {["low", "medium", "high", "urgent"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  {form.kind === "task" && (
                    <label className="crm-field">
                      Project
                      <select
                        disabled={!!editing}
                        value={form.parent_id}
                        onChange={(e) =>
                          setForm({ ...form, parent_id: e.target.value })
                        }
                      >
                        <option value="">Standalone task</option>
                        {items
                          .filter((i) => i.kind === "project")
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.title}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </div>
                <label className="crm-field">
                  Next action / definition of done
                  <textarea
                    maxLength={10000}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </label>
                <label className="crm-field">
                  Blocker / decision needed
                  <input
                    maxLength={1000}
                    value={form.blocker}
                    onChange={(e) =>
                      setForm({ ...form, blocker: e.target.value })
                    }
                  />
                </label>
                <div className="operations-toolbar">
                  <button className="crm-primary-btn" disabled={busy}>
                    Save work
                  </button>
                  <button
                    type="button"
                    className="crm-text-btn"
                    disabled={busy}
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}
          <nav className="operations-toolbar" aria-label="Work views">
            {[
              ["all", "All work"],
              ["projects", "Projects"],
              ["mine", "My work"],
              ["roadmap", "CRM roadmap"],
              ["blocked", "Blocked"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={view === key ? "crm-primary-btn" : "crm-text-btn"}
                aria-pressed={view === key}
                onClick={() => setView(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          {!loading && !error && !visible.length && (
            <p className="crm-muted">No work matches this view.</p>
          )}
          <div className="operations-board">
            {STATUSES.map((status) => (
              <section key={status} className="operations-column">
                <h2>
                  {statusLabel(status)}{" "}
                  <span className="crm-count-pill">
                    {visible.filter((i) => i.status === status).length}
                  </span>
                </h2>
                {visible
                  .filter((i) => i.status === status)
                  .map((item) => (
                    <article
                      key={item.id}
                      className="crm-panel operations-card"
                    >
                      <small>
                        {item.division} · {item.kind} · {item.priority}
                      </small>
                      <h3>{item.title}</h3>
                      {ownsWorkspace && (
                        <button
                          className="crm-text-btn"
                          disabled={busy || loading}
                          onClick={() => {
                            setEditing(item);
                            setForm({
                              title: item.title,
                              description: item.description,
                              division: item.division,
                              kind: item.kind,
                              parent_id: item.parent_id || "",
                              assigned_user_id: item.assigned_user_id || "",
                              due_date: item.due_date || "",
                              priority: item.priority,
                              blocker: item.blocker,
                            });
                            setShowForm(true);
                          }}
                        >
                          Edit
                        </button>
                      )}
                      {item.parent_id && (
                        <p className="crm-muted">
                          Project:{" "}
                          {items.find((i) => i.id === item.parent_id)?.title ||
                            "Project"}
                        </p>
                      )}
                      <p>{item.description}</p>
                      <p className="crm-muted">
                        {nameFor(item.assigned_user_id)} ·{" "}
                        {item.due_date || "No deadline"}
                      </p>
                      {item.blocker && (
                        <p className="crm-banner crm-banner-warning">
                          Blocked: {item.blocker}
                        </p>
                      )}
                      <label className="crm-field">
                        Status
                        <select
                          value={item.status}
                          disabled={
                            busy ||
                            loading ||
                            (!ownsWorkspace &&
                              item.assigned_user_id !== profile?.id)
                          }
                          onChange={(e) =>
                            void run(async () => {
                              const result =
                                await createSupabaseBrowserClient().rpc(
                                  "operations_set_status",
                                  {
                                    p_id: item.id,
                                    p_status: e.target.value as WorkStatus,
                                    p_expected_updated_at: item.updated_at,
                                  },
                                );
                              if (result.error) throw result.error;
                            })
                          }
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {statusLabel(s)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </article>
                  ))}
              </section>
            ))}
          </div>
        </>
      )}
      <section className="crm-panel">
        <div className="crm-panel-head">
          <h2>My client follow-ups</h2>
          <Link className="crm-text-btn" to="/crm/tasks">
            Open client task queue
          </Link>
        </div>
        {clientError && (
          <p role="alert" className="crm-banner crm-banner-error">
            Client tasks: {clientError}
          </p>
        )}
        {!loading && !clientError && !clientTasks.length && (
          <p className="crm-muted">No open client tasks assigned to you.</p>
        )}
        <ul className="crm-task-list">
          {clientTasks.map((t) => (
            <li key={t.id} className="crm-task-row">
              <div>
                <Link to={`/crm/tasks?task=${t.id}`}>{t.title}</Link>
                <p className="crm-muted">
                  {t.household?.display_name} · {t.due_date || "No deadline"} ·{" "}
                  {t.priority}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
