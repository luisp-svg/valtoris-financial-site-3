import FieldShell, { fieldId } from './FieldShell'

export type SelectOption = {
  value: string
  label: string
}

type SelectInputProps = {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  options: readonly SelectOption[]
  placeholder?: string
  required?: boolean
}

export default function SelectInput({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  required = false,
}: SelectInputProps) {
  return (
    <FieldShell label={label} name={name} required={required}>
      <select
        id={fieldId(name)}
        name={name}
        className="assessment-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      >
        <option value="" disabled>
          {placeholder ?? `Select ${label.toLowerCase()}`}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}
