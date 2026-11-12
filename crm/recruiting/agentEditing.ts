import type { Recruit } from './types'
/** Removing follow-up inputs must not erase values stored before the UI change. */
export const retainedAgentFields = (record: Recruit) => ({
 assigned_advisor_id: record.assigned_advisor_id,
 next_action: record.next_action,
 next_action_due_on: record.next_action_due_on,
})
