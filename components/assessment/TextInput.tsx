import FieldShell, { fieldId } from './FieldShell'

type TextInputProps = {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'email' | 'tel'
  placeholder?: string
  required?: boolean
  min?: number
  max?: number
  maxLength?: number
}

export default function TextInput({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  min,
  max,
  maxLength,
}: TextInputProps) {
  return (
    <FieldShell label={label} name={name} required={required}>
      <input
        id={fieldId(name)}
        name={name}
        type={type}
        className="assessment-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        maxLength={maxLength}
        required={required}
      />
    </FieldShell>
  )
}
