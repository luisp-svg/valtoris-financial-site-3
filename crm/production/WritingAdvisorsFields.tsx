import { useMemo } from 'react'
import {
  advisorLicensingWarning,
  emptyWritingAdvisorRow,
  formatWritingPercent,
  patchWritingPercent,
  writingBpsToPercentInput,
  writingSplitSummary,
} from './writingSplits'
import { defaultWritingAllocations } from './applicationView'
import type { ProductionAdvisorOption, ProductionAllocationDraft } from './types'

export type WritingAdvisorsFieldsProps = {
  advisors: ProductionAdvisorOption[]
  allocations: ProductionAllocationDraft[]
  state: string
  disabled: boolean
  fieldError?: string
  reason?: string
  reasonError?: string
  showReason?: boolean
  note?: string | null
  onAllocationsChange: (rows: ProductionAllocationDraft[]) => void
  onReasonChange?: (value: string) => void
}

export default function WritingAdvisorsFields(props: WritingAdvisorsFieldsProps) {
  const selectedAdvisorIds = useMemo(
    () => new Set(props.allocations.map((row) => row.advisor_id)),
    [props.allocations],
  )
  const summary = writingSplitSummary(props.allocations)

  function addWriter() {
    const next = props.advisors.find((advisor) => !selectedAdvisorIds.has(advisor.id))
    if (!next) return
    if (props.allocations.length === 0) {
      props.onAllocationsChange(defaultWritingAllocations(next.id))
      return
    }
    props.onAllocationsChange([...props.allocations, emptyWritingAdvisorRow(next.id)])
  }

  function updateWriter(index: number, patch: Partial<ProductionAllocationDraft>) {
    props.onAllocationsChange(
      props.allocations.map((row, i) =>
        i === index
          ? {
              ...row,
              ...patch,
              recipient_type: 'advisor',
              allocation_role: 'writing',
            }
          : row,
      ),
    )
  }

  function updatePercent(index: number, raw: string) {
    props.onAllocationsChange(
      props.allocations.map((row, i) => (i === index ? patchWritingPercent(row, raw) : row)),
    )
  }

  function removeWriter(index: number) {
    props.onAllocationsChange(props.allocations.filter((_, i) => i !== index))
  }

  return (
    <fieldset className="crm-application-entry-fieldset crm-application-writing-advisors" disabled={props.disabled}>
      <legend>Writing advisors</legend>
      <p className="crm-muted">
        Split writing credit so the percentages total 100%. The server snapshots each advisor&apos;s
        contract level. House and servicing allocations are not entered here.
        {props.note ? ` ${props.note}` : ''}
      </p>
      {props.allocations.map((row, index) => {
        const advisor = props.advisors.find((option) => option.id === row.advisor_id)
        const licenseWarning = advisorLicensingWarning(advisor, props.state)
        return (
          <div key={`${row.advisor_id}-${index}`} className="crm-application-allocation-row">
            <label className="crm-field">
              <span>Advisor</span>
              <select
                aria-label={`Writing advisor ${index + 1}`}
                value={row.advisor_id}
                onChange={(e) => updateWriter(index, { advisor_id: e.target.value })}
                required
              >
                <option value="">Select an advisor</option>
                {props.advisors.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="crm-field crm-application-allocation-percent">
              <span>Allocation percentage</span>
              <input
                aria-label={`Allocation percentage ${index + 1}`}
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="1"
                value={writingBpsToPercentInput(row.commission_bps)}
                onChange={(e) => updatePercent(index, e.target.value)}
                required
              />
            </label>
            {props.allocations.length > 1 ? (
              <button type="button" className="crm-text-btn" onClick={() => removeWriter(index)}>
                Remove
              </button>
            ) : null}
            {licenseWarning ? <p className="crm-muted crm-application-license-warning">{licenseWarning}</p> : null}
          </div>
        )
      })}
      <p className="crm-application-split-summary" aria-live="polite">
        Allocated: {formatWritingPercent(summary.allocatedBps)}
        {' · '}
        Remaining: {formatWritingPercent(summary.remainingBps)}
      </p>
      {props.advisors.some((advisor) => !selectedAdvisorIds.has(advisor.id)) ? (
        <button type="button" className="crm-secondary-btn" onClick={addWriter}>
          Add writing advisor
        </button>
      ) : null}
      {props.showReason ? (
        <label className="crm-field">
          <span>Allocation change reason</span>
          <input
            aria-label="Allocation change reason"
            value={props.reason ?? ''}
            onChange={(e) => props.onReasonChange?.(e.target.value)}
            aria-invalid={Boolean(props.reasonError)}
          />
          {props.reasonError ? <span className="crm-field-error">{props.reasonError}</span> : null}
        </label>
      ) : null}
      {props.fieldError ? <span className="crm-field-error">{props.fieldError}</span> : null}
    </fieldset>
  )
}
