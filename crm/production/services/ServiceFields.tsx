import type { ServiceDraft, ServiceLine, WritingSplit } from './model'
import { SERVICE_LINES, STATUSES, VALUE_BASES, isPremium } from './model'
export function ServiceFields({
  draft,
  change,
  lines,
  locked = false,
}: {
  draft: ServiceDraft
  change: (d: ServiceDraft) => void
  lines: ServiceLine[]
  locked?: boolean
}) {
  function set<K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]) {
    change({ ...draft, [key]: value })
  }
  return (
    <div className="service-grid">
      <label>
        Service line
        <select
          value={draft.service_line}
          disabled={locked}
          onChange={(e) => {
            const line = e.target.value as ServiceLine
            change({
              ...draft,
              service_line: line,
              value_basis: isPremium(line)
                ? 'annual_premium'
                : 'contract_value',
            })
          }}
        >
          {lines.map((line) => (
            <option key={line} value={line}>
              {SERVICE_LINES[line]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Provider / carrier
        <input
          required
          maxLength={200}
          value={draft.provider_name}
          onChange={(e) => set('provider_name', e.target.value)}
        />
      </label>
      <label>
        Product or service sold
        <input
          required
          maxLength={200}
          value={draft.product_name}
          onChange={(e) => set('product_name', e.target.value)}
        />
      </label>
      <label>
        Reference number (optional)
        <input
          maxLength={100}
          value={draft.external_reference}
          onChange={(e) => set('external_reference', e.target.value)}
        />
      </label>
      <label>
        Production status
        <select
          value={draft.production_status}
          onChange={(e) =>
            set(
              'production_status',
              e.target.value as ServiceDraft['production_status'],
            )
          }
        >
          {Object.entries(STATUSES).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Submission date
        <input
          type="date"
          required={['submitted', 'completed'].includes(
            draft.production_status,
          )}
          value={draft.submission_date}
          onChange={(e) => set('submission_date', e.target.value)}
        />
      </label>
      <label>
        Value basis
        <select
          value={draft.value_basis}
          onChange={(e) =>
            set('value_basis', e.target.value as ServiceDraft['value_basis'])
          }
        >
          {Object.entries(VALUE_BASES)
            .filter(([v]) =>
              isPremium(draft.service_line)
                ? v === 'annual_premium'
                : v !== 'annual_premium',
            )
            .map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
        </select>
      </label>
      <label>
        Production value in USD (optional)
        <input
          inputMode="decimal"
          placeholder="Leave blank if unknown"
          value={draft.value}
          onChange={(e) => set('value', e.target.value)}
        />
        <small>This is production value, not advisor compensation.</small>
      </label>
      <label className="service-wide">
        Notes (optional)
        <textarea
          maxLength={5000}
          rows={3}
          value={draft.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </label>
    </div>
  )
}
export function SplitFields({
  splits,
  change,
  advisors,
}: {
  splits: WritingSplit[]
  change: (v: WritingSplit[]) => void
  advisors: { id: string; display_name: string }[]
}) {
  return (
    <fieldset>
      <legend>Writing advisors</legend>
      <p>
        Writing shares must total 100%. These shares do not calculate
        compensation.
      </p>
      {splits.map((row, i) => (
        <div className="service-split" key={i}>
          <label>
            Writing advisor {i + 1}
            <select
              required
              value={row.advisor_id}
              onChange={(e) =>
                change(
                  splits.map((s, j) =>
                    j === i ? { ...s, advisor_id: e.target.value } : s,
                  ),
                )
              }
            >
              <option value="">Choose advisor</option>
              {advisors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Writing share (%)
            <input
              required
              inputMode="decimal"
              value={row.percent}
              onChange={(e) =>
                change(
                  splits.map((s, j) =>
                    j === i ? { ...s, percent: e.target.value } : s,
                  ),
                )
              }
            />
          </label>
          {splits.length > 1 && (
            <button
              type="button"
              className="crm-secondary-btn"
              onClick={() => change(splits.filter((_, j) => j !== i))}
            >
              Remove advisor {i + 1}
            </button>
          )}
        </div>
      ))}
      {splits.length < 20 && (
        <button
          type="button"
          className="crm-secondary-btn"
          onClick={() => change([...splits, { advisor_id: '', percent: '' }])}
        >
          Add writing advisor
        </button>
      )}
    </fieldset>
  )
}
