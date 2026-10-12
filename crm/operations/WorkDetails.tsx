import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import type { WorkItem } from "./model";
type Comment = {
  id: string;
  body: string;
  author_user_id: string;
  created_at: string;
};
type Check = { id: string; title: string; done: boolean };
export default function WorkDetails({
  item,
  userId,
  ownsWorkspace,
  nameFor,
}: {
  item: WorkItem;
  userId: string;
  ownsWorkspace: boolean;
  nameFor: (id: string | null) => string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const commentId = useRef(crypto.randomUUID());
  const checkId = useRef(crypto.randomUUID());
  const revision = useRef(0);
  const load = useCallback(async () => {
    const seq = ++revision.current;
    const db = createSupabaseBrowserClient();
    const [a, b] = await Promise.all([
      db
        .from("operations_comments")
        .select("id,body,author_user_id,created_at")
        .eq("workspace_id", item.workspace_id)
        .eq("item_id", item.id)
        .order("created_at"),
      db
        .from("operations_checklist")
        .select("id,title,done")
        .eq("workspace_id", item.workspace_id)
        .eq("item_id", item.id)
        .order("created_at"),
    ]);
    if (seq !== revision.current) return;
    if (a.error || b.error) throw a.error || b.error;
    setComments(a.data ?? []);
    setChecks(b.data ?? []);
    setReady(true);
  }, [item.id, item.workspace_id]);
  useEffect(() => {
    const counter = revision;
    void load().catch(() =>
      setError(
        "Collaboration is unavailable. Refresh or contact your workspace owner.",
      ),
    );
    const timer = setInterval(
      () =>
        void load().catch(() => setError("Unable to refresh collaboration.")),
      30000,
    );
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
      setError(
        e instanceof Error
          ? e.message
          : e && typeof e === "object" && "message" in e
            ? String(e.message)
            : "Unable to save.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function add(event: FormEvent, kind: "comment" | "check") {
    event.preventDefault();
    await run(async () => {
      const db = createSupabaseBrowserClient();
      const id = kind === "comment" ? commentId : checkId;
      const values =
        kind === "comment"
          ? { body: body.trim(), author_user_id: userId }
          : { title: title.trim() };
      const result = await db
        .from(
          kind === "comment" ? "operations_comments" : "operations_checklist",
        )
        .upsert(
          {
            id: id.current,
            workspace_id: item.workspace_id,
            item_id: item.id,
            ...values,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
      if (result.error) throw result.error;
      id.current = crypto.randomUUID();
      if (kind === "comment") setBody("");
      else setTitle("");
    });
  }
  return (
    <section aria-label={`Details for ${item.title}`}>
      {error && (
        <p role="alert" className="crm-banner crm-banner-error">
          {error}
        </p>
      )}
      <h4>
        Checklist · {checks.filter((c) => c.done).length}/{checks.length}
      </h4>
      {checks.map((c) => (
        <label key={c.id} className="operations-check">
          <input
            type="checkbox"
            checked={c.done}
            disabled={
              busy ||
              !ready ||
              (!ownsWorkspace && item.assigned_user_id !== userId)
            }
            onChange={() =>
              void run(async () => {
                const r = await createSupabaseBrowserClient().rpc(
                  "operations_toggle_checklist",
                  { p_id: c.id, p_expected_done: c.done },
                );
                if (r.error) throw r.error;
              })
            }
          />
          {c.title}
        </label>
      ))}
      {ownsWorkspace && (
        <form onSubmit={(e) => void add(e, "check")}>
          <label className="crm-field">
            Checklist step
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
            />
          </label>
          <button
            className="crm-text-btn"
            disabled={busy || !ready || !title.trim()}
          >
            Add step
          </button>
        </form>
      )}
      <h4>Discussion</h4>
      {comments.map((c) => (
        <div className="operations-comment" key={c.id}>
          <small>
            {nameFor(c.author_user_id)} ·{" "}
            {new Date(c.created_at).toLocaleString()}
          </small>
          <p>{c.body}</p>
        </div>
      ))}
      {!comments.length && <p className="crm-muted">No comments yet.</p>}
      <form onSubmit={(e) => void add(e, "comment")}>
        <label className="crm-field">
          Comment
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={4000}
          />
        </label>
        <button
          className="crm-text-btn"
          disabled={busy || !ready || !body.trim()}
        >
          Post comment
        </button>
      </form>
    </section>
  );
}
