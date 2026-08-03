import { Link } from 'react-router-dom'
import EmptyState from '../../../components/ui/EmptyState'
import Widget from '../../../components/ui/Widget'
import {
  crmHouseholdAssessmentDetailPath,
  crmHouseholdAssessmentsPath,
  crmHouseholdPath,
} from '../../../../constants/routes'
import { extractTopPriorityTitles } from '../../assessments/diagnosticFormatters'
import {
  PUBLIC_FAMILY_DIAGNOSTIC_DISCLAIMER,
  PUBLIC_FAMILY_DIAGNOSTIC_PRODUCT_LABEL,
} from '../../assessments/types'
import { formatTaskDueDate, mapTaskStatusLabel } from '../../../intake/intakeTaskAutomation'
import type { TaskStatus } from '../../../tasks/types'
import type { ClientWorkspaceModel } from '../financialProgress/attachFinancialProgress'

type Props = {
  workspace: ClientWorkspaceModel
  householdId: string
}

function formatSubmittedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function InitialFinancialDiagnosticWidget({ workspace, householdId }: Props) {
  const diagnostic = workspace.publicFamilyDiagnostic
  const count = workspace.publicFamilyDiagnosticCount
  const displayPriorities = diagnostic
    ? extractTopPriorityTitles(diagnostic.priorities, diagnostic.answers, 3)
    : []
  const reviewTask = diagnostic
    ? workspace.openTasks.find(
        (task) =>
          task.assessment_id === diagnostic.id &&
          (task.workflow_type === 'review_initial_diagnostic' ||
            task.workflow_type === 'resolve_possible_duplicate'),
      ) ??
      workspace.openTasks.find(
        (task) =>
          task.workflow_type === 'review_initial_diagnostic' ||
          task.workflow_type === 'resolve_possible_duplicate',
      )
    : null

  return (
    <Widget
      title={PUBLIC_FAMILY_DIAGNOSTIC_PRODUCT_LABEL}
      titleId="crm-widget-initial-financial-diagnostic"
      meta={<span className="crm-intake-chip">Self-reported</span>}
      actions={
        diagnostic ? (
          <div className="crm-ifd-widget-actions">
            <Link
              className="crm-text-btn"
              to={crmHouseholdAssessmentDetailPath(householdId, diagnostic.id)}
            >
              View Diagnostic
            </Link>
            <Link className="crm-text-btn" to={crmHouseholdAssessmentsPath(householdId)}>
              {count > 1 ? `View History (${count})` : 'View History'}
            </Link>
          </div>
        ) : null
      }
    >
      {!diagnostic ? (
        <EmptyState
          title="No public diagnostic yet"
          description="No public Family Financial Report Card has been submitted for this household."
        />
      ) : (
        <>
          <p className="crm-muted crm-ifd-widget-disclaimer">{PUBLIC_FAMILY_DIAGNOSTIC_DISCLAIMER}</p>
          <dl className="crm-client-workspace-info-list">
            <div>
              <dt>Diagnostic score</dt>
              <dd
                className="crm-financial-progress-score-emphasis"
                aria-label="Initial Financial Diagnostic score"
              >
                {diagnostic.overall_score ?? '—'}
              </dd>
            </div>
            <div>
              <dt>Grade</dt>
              <dd aria-label="Initial Financial Diagnostic grade">
                {diagnostic.overall_grade ?? '—'}
              </dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>{formatSubmittedAt(diagnostic.completed_at)}</dd>
            </div>
            <div>
              <dt>Evidence type</dt>
              <dd>Self-reported public diagnostic</dd>
            </div>
          </dl>
          <div className="crm-ifd-widget-task" aria-label="Follow-up review task">
            <p className="crm-muted">Follow-up review task</p>
            {reviewTask ? (
              <dl className="crm-client-workspace-info-list">
                <div>
                  <dt>Status</dt>
                  <dd>{mapTaskStatusLabel(reviewTask.status as TaskStatus)}</dd>
                </div>
                <div>
                  <dt>Due</dt>
                  <dd>{formatTaskDueDate(reviewTask.due_date)}</dd>
                </div>
                <div>
                  <dt>Task</dt>
                  <dd>{reviewTask.title}</dd>
                </div>
              </dl>
            ) : (
              <p className="crm-muted">No open follow-up review task linked to this diagnostic.</p>
            )}
            <Link className="crm-text-btn" to={`${crmHouseholdPath(householdId)}?tab=tasks`}>
              Open Tasks
            </Link>
          </div>
          {displayPriorities.length > 0 ? (
            <div className="crm-ifd-widget-priorities">
              <p className="crm-muted">Top priorities</p>
              <ul>
                {displayPriorities.map((priority) => (
                  <li key={priority}>{priority}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </Widget>
  )
}
