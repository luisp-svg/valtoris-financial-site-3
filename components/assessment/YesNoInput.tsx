import FieldShell, { fieldId } from './FieldShell'

type YesNoInputProps = {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  yesLabel?: string
  noLabel?: string
}

export default function YesNoInput({
  label,
  name,
  value,
  onChange,
  required = false,
  yesLabel = 'Yes',
  noLabel = 'No',
}: YesNoInputProps) {
  const id = fieldId(name)

  return (
    <FieldShell label={label} name={name} required={required}>
      <div className="yes-no-group" role="group" aria-labelledby={id}>
        <span id={id} className="sr-only">
          {label}
        </span>
        {(['yes', 'no'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`yes-no-option${value === option ? ' is-selected' : ''}`}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {option === 'yes' ? yesLabel : noLabel}
          </button>
        ))}
      </div>
    </FieldShell>
  )
}
