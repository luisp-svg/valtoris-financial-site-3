import { describe, expect, it } from "vitest";
import { summarizeWork, type WorkItem } from "./model";
const item = (fields: Partial<WorkItem>): WorkItem => ({
  id: "1",
  workspace_id: "w",
  kind: "task",
  parent_id: null,
  title: "Review",
  description: "",
  division: "Operations",
  status: "planned",
  priority: "medium",
  assigned_user_id: "liz",
  due_date: null,
  blocker: "",
  updated_at: "2026-10-09",
  ...fields,
});
describe("Operations workload", () => {
  it("excludes finished and cancelled work from workload even when overdue or blocked", () => {
    expect(
      summarizeWork(
        [
          item({ status: "done", due_date: "2020-01-01", blocker: "old" }),
          item({ status: "cancelled" }),
          item({
            kind: "project",
            due_date: "2026-10-08",
            blocker: "Needs decision",
          }),
          item({ due_date: "2026-10-09" }),
        ],
        "2026-10-09",
        "liz",
      ),
    ).toEqual({ projects: 1, overdue: 1, blocked: 1, mine: 2 });
  });
  it("does not count missing deadlines or another owner as personal overdue work", () => {
    expect(
      summarizeWork(
        [item({ assigned_user_id: "jaz", blocker: "  " })],
        "2026-10-09",
        "liz",
      ),
    ).toEqual({ projects: 0, overdue: 0, blocked: 0, mine: 0 });
  });
});
