import { ReactNode } from 'react'

type FieldShellProps = {
  label: string
  name: string
  required?: boolean
  children: ReactNode
}

export default function FieldShell({ label, name, required = false, children }: FieldShellProps) {
  const id = `assessment-${name}`

  return (
    <div className="assessment-field">
      <label className="assessment-field-label" htmlFor={id}>
        {label}
        {required && ' *'}
      </label>
      {children}
    </div>
  )
}

export function fieldId(name: string) {
  return `assessment-${name}`
}
