import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
type Procedure = {
  id: string;
  procedure_key: string;
  version: number;
  title: string;
  body: string;
  created_at: string;
};
export default function ProcedureLibrary({
  workspaceId,
  ownsWorkspace,
}: {
  workspaceId: string;
  ownsWorkspace: boolean;
}) {
  const [rows, setRows] = useState<Procedure[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Procedure | null>(null),
    [open, setOpen] = useState(false),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [requestId, setRequestId] = useState(() => crypto.randomUUID()),
    [key, setKey] = useState(() => crypto.randomUUID());
  const load = useCallback(async () => {
    const r = await createSupabaseBrowserClient()
      .from("operations_procedures")
      .select("id,procedure_key,version,title,body,created_at")
      .eq("workspace_id", workspaceId)
      .order("version", { ascending: false });
    if (r.error) {
      setError("Procedures are unavailable.");
      return;
    }
    setRows(r.data ?? []);
  }, [workspaceId]);
  useEffect(() => {
    void load();
  }, [load]);
  const latest = rows.filter(
    (r, i) => rows.findIndex((p) => p.procedure_key === r.procedure_key) === i,
  );
  return (
    <section className="crm-panel">
      <div className="crm-panel-head">
        <h2>Procedures & playbooks</h2>
        {ownsWorkspace && (
          <button
            className="crm-text-btn"
            onClick={() => {
              setEditing(null);
              setTitle("");
              setBody("");
              setOpen(true);
              setRequestId(crypto.randomUUID());
              setKey(crypto.randomUUID());
            }}
          >
            New procedure
          </button>
        )}
      </div>
      <p className="crm-muted">
        Workspace knowledge with preserved revision history. Use it for scripts,
        handoffs, onboarding, and division procedures.
      </p>
      {error && <p role="alert">{error}</p>}
      {open && ownsWorkspace && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            void (async () => {
              try {
                const r = await createSupabaseBrowserClient()
                  .from("operations_procedures")
                  .upsert(
                    {
                      id: requestId,
                      workspace_id: workspaceId,
                      procedure_key: editing?.procedure_key || key,
                      version: editing ? editing.version + 1 : 1,
                      title: title.trim(),
                      body: body.trim(),
                    },
                    { onConflict: "id", ignoreDuplicates: true },
                  );
                if (r.error) throw r.error;
                setOpen(false);
                await load();
              } catch {
                setError(
                  "Unable to publish. Refresh procedures before retrying; another revision may have been published.",
                );
                await load();
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <label className="crm-field">
            Procedure title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
            />
          </label>
          <label className="crm-field">
            Procedure content
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={20000}
              rows={8}
              required
            />
          </label>
          <button
            className="crm-primary-btn"
            disabled={busy || !title.trim() || !body.trim()}
          >
            Publish revision
          </button>
          <button
            type="button"
            className="crm-text-btn"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel procedure
          </button>
        </form>
      )}
      {!latest.length && !error && <p>No procedures yet.</p>}
      {latest.map((p) => (
        <details key={p.procedure_key}>
          <summary>
            {p.title} · version {p.version}
          </summary>
          <p className="operations-procedure-body">{p.body}</p>
          <small>Published {new Date(p.created_at).toLocaleString()}</small>
          {ownsWorkspace && (
            <button
              className="crm-text-btn"
              onClick={() => {
                setEditing(p);
                setTitle(p.title);
                setBody(p.body);
                setOpen(true);
                setRequestId(crypto.randomUUID());
              }}
            >
              Revise procedure
            </button>
          )}
          <details>
            <summary>Revision history</summary>
            {rows
              .filter((r) => r.procedure_key === p.procedure_key)
              .map((r) => (
                <details key={r.id}>
                  <summary>
                    Version {r.version} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </summary>
                  <p className="operations-procedure-body">{r.body}</p>
                </details>
              ))}
          </details>
        </details>
      ))}
    </section>
  );
}
