export const STATUSES = [
  "backlog",
  "planned",
  "in_progress",
  "testing",
  "done",
  "cancelled",
] as const;
export type WorkStatus = (typeof STATUSES)[number];
export type WorkItem = {
  id: string;
  workspace_id: string;
  kind: "project" | "task";
  parent_id: string | null;
  title: string;
  description: string;
  division: string;
  status: WorkStatus;
  priority: "low" | "medium" | "high" | "urgent";
  assigned_user_id: string | null;
  due_date: string | null;
  blocker: string;
  updated_at: string;
};
export function summarizeWork(
  items: WorkItem[],
  today: string,
  userId: string,
) {
  const active = items.filter(
    (i) => i.status !== "done" && i.status !== "cancelled",
  );
  return {
    projects: active.filter((i) => i.kind === "project").length,
    overdue: active.filter((i) => i.due_date && i.due_date < today).length,
    blocked: active.filter((i) => i.blocker.trim()).length,
    mine: active.filter((i) => i.assigned_user_id === userId).length,
  };
}
export function statusLabel(status: WorkStatus) {
  return status === "done"
    ? "Live / Done"
    : status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
