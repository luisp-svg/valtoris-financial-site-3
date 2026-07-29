import {
  formatCentsForInput,
  parseMoneyToCents,
  type MoneyCents,
} from '../onboardingMoney'

type MoneyFieldProps = {
  label: string
  name: string
  value: MoneyCents
  onChange: (cents: MoneyCents) => void
  disabled?: boolean
  required?: boolean
  hint?: string
  error?: string
}

/** Controlled money field storing integer cents; blank ≠ zero. */
export default function MoneyField({
  label,
  name,
  value,
  onChange,
  disabled,
  required,
  hint,
  error,
}: MoneyFieldProps) {
  const display = formatCentsForInput(value)

  return (
    <label className="crm-field">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      <div className="crm-onboarding-money-input">
        <span aria-hidden="true">$</span>
        <input
          name={name}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={display}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            const raw = event.target.value
            if (raw.trim() === '') {
              onChange(null)
              return
            }
            const parsed = parseMoneyToCents(raw)
            if (parsed.error) return
            onChange(parsed.cents)
          }}
        />
      </div>
      {hint ? <span className="crm-field-hint">{hint}</span> : null}
      {error ? <span className="crm-field-error">{error}</span> : null}
    </label>
  )
}
