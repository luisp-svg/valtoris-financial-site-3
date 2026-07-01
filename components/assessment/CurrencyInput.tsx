import FieldShell, { fieldId } from './FieldShell'

type CurrencyInputProps = {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}

function formatDisplayValue(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('en-US')
}

export default function CurrencyInput({
  label,
  name,
  value,
  onChange,
  placeholder = '0',
  required = false,
}: CurrencyInputProps) {
  function handleChange(nextDisplayValue: string) {
    onChange(nextDisplayValue.replace(/\D/g, ''))
  }

  return (
    <FieldShell label={label} name={name} required={required}>
      <div className="currency-input-wrapper">
        <span className="currency-input-prefix" aria-hidden="true">
          $
        </span>
        <input
          id={fieldId(name)}
          name={name}
          type="text"
          inputMode="numeric"
          className="assessment-input currency-input"
          value={formatDisplayValue(value)}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          aria-label={`${label} in dollars`}
        />
      </div>
    </FieldShell>
  )
}
