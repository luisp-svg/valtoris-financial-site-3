import FieldShell from './FieldShell'

export type ChoiceOption = {
  value: string
  label: string
}

type ChoiceGroupProps = {
  label: string
  name: string
  options: readonly ChoiceOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  required?: boolean
}

export default function ChoiceGroup({
  label,
  name,
  options,
  selected,
  onChange,
  required = false,
}: ChoiceGroupProps) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value))
      return
    }
    onChange([...selected, value])
  }

  return (
    <FieldShell label={label} name={name} required={required}>
      <div className="choice-group" role="group" aria-label={label}>
        {options.map((option) => {
          const isSelected = selected.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              className={`choice-option${isSelected ? ' is-selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => toggle(option.value)}
            >
              <span className="choice-option-check" aria-hidden="true">
                {isSelected ? '✓' : ''}
              </span>
              {option.label}
            </button>
          )
        })}
      </div>
    </FieldShell>
  )
}
