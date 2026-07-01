import SelectInput from '../../assessment/SelectInput'
import TextInput from '../../assessment/TextInput'
import { CalculatorQuestionCard } from '../CalculatorHelpers'
import { MARITAL_STATUS_OPTIONS, US_STATES } from '../constants'
import { FamilyStepAnswers } from '../types'

type CalcStepOneFamilyProps = {
  answers: FamilyStepAnswers
  onChange: (field: keyof FamilyStepAnswers, value: string) => void
}

export default function CalcStepOneFamily({ answers, onChange }: CalcStepOneFamilyProps) {
  return (
    <CalculatorQuestionCard title="About Your Family">
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <TextInput
          label="First Name"
          name="calcFirstName"
          value={answers.firstName}
          onChange={(value) => onChange('firstName', value)}
          required
        />
        <TextInput
          label="Last Name"
          name="calcLastName"
          value={answers.lastName}
          onChange={(value) => onChange('lastName', value)}
          required
        />
        <TextInput
          label="Email"
          name="calcEmail"
          type="email"
          value={answers.email}
          onChange={(value) => onChange('email', value)}
          placeholder="you@email.com"
          required
        />
        <TextInput
          label="Phone"
          name="calcPhone"
          type="tel"
          value={answers.phone}
          onChange={(value) => onChange('phone', value)}
          placeholder="(555) 555-5555"
          required
        />
        <TextInput
          label="Age"
          name="calcAge"
          type="number"
          value={answers.age}
          onChange={(value) => onChange('age', value)}
          min={18}
          max={120}
          required
        />
        <SelectInput
          label="State"
          name="calcState"
          value={answers.state}
          onChange={(value) => onChange('state', value)}
          options={US_STATES}
          required
        />
        <SelectInput
          label="Marital Status"
          name="calcMaritalStatus"
          value={answers.maritalStatus}
          onChange={(value) => onChange('maritalStatus', value)}
          options={MARITAL_STATUS_OPTIONS}
          required
        />
        <TextInput
          label="Number of Children"
          name="calcChildren"
          type="number"
          value={answers.numberOfChildren}
          onChange={(value) => onChange('numberOfChildren', value)}
          min={0}
          max={20}
          required
        />
      </form>
    </CalculatorQuestionCard>
  )
}
