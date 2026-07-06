import QuestionCard from '../QuestionCard'
import SelectInput from '../SelectInput'
import TextInput from '../TextInput'
import { MARITAL_STATUS_OPTIONS, US_STATES } from '../constants'
import { FamilyAnswers } from '../types'

type StepTwoFamilyProps = {
  answers: FamilyAnswers
  onChange: (field: keyof FamilyAnswers, value: string) => void
}

export default function StepTwoFamily({ answers, onChange }: StepTwoFamilyProps) {
  return (
    <QuestionCard
      title="About Your Family"
      description="Tell us a little about your household so we can personalize your report card."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <TextInput
          label="First Name"
          name="firstName"
          value={answers.firstName}
          onChange={(value) => onChange('firstName', value)}
          placeholder="Enter your first name"
          required
        />
        <TextInput
          label="Last Name"
          name="lastName"
          value={answers.lastName}
          onChange={(value) => onChange('lastName', value)}
          placeholder="Enter your last name"
          required
        />
        <TextInput
          label="Email"
          name="email"
          type="email"
          value={answers.email}
          onChange={(value) => onChange('email', value)}
          placeholder="you@email.com"
          required
        />
        <TextInput
          label="Phone"
          name="phone"
          type="tel"
          value={answers.phone}
          onChange={(value) => onChange('phone', value)}
          placeholder="(555) 555-5555"
          required
        />
        <TextInput
          label="Age"
          name="age"
          type="number"
          value={answers.age}
          onChange={(value) => onChange('age', value)}
          placeholder="Enter your age"
          min={18}
          max={120}
          required
        />
        <SelectInput
          label="State"
          name="state"
          value={answers.state}
          onChange={(value) => onChange('state', value)}
          options={US_STATES}
          required
        />
        <SelectInput
          label="Marital Status"
          name="maritalStatus"
          value={answers.maritalStatus}
          onChange={(value) => onChange('maritalStatus', value)}
          options={MARITAL_STATUS_OPTIONS}
          required
        />
        <TextInput
          label="Number of Children"
          name="numberOfChildren"
          type="number"
          value={answers.numberOfChildren}
          onChange={(value) => onChange('numberOfChildren', value)}
          placeholder="0"
          min={0}
          max={20}
          required
        />
      </form>
    </QuestionCard>
  )
}
