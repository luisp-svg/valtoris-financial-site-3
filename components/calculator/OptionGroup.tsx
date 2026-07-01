import FieldShell from '../assessment/FieldShell'

export type OptionItem = {
  value: string
  label: string
  badge?: string
}

type OptionGroupProps = {
  label: string
  name: string
  options: readonly OptionItem[]
  value: string
  onChange: (value: string) => void
  required?: boolean
}

export default function OptionGroup({
  label,
  name,
  options,
  value,
  onChange,
  required = false,
}: OptionGroupProps) {
  return (
    <FieldShell label={label} name={`calc-${name}`} required={required}>
      <div className="option-group" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`option-chip${value === option.value ? ' is-selected' : ''}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <span>{option.label}</span>
            {option.badge && <span className="option-chip-badge">{option.badge}</span>}
          </button>
        ))}
      </div>
    </FieldShell>
  )
}
