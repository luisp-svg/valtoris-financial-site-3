import QuestionCard from '../../QuestionCard'
import SelectInput from '../../SelectInput'
import TextInput from '../../TextInput'
import {
  BUSINESS_INDUSTRY_OPTIONS,
  EMPLOYEE_COUNT_OPTIONS,
  GROSS_ANNUAL_REVENUE_OPTIONS,
  OWNER_COMPENSATION_METHOD_OPTIONS,
  OWNER_PERSONAL_INCOME_OPTIONS,
  YEARS_IN_BUSINESS_OPTIONS,
} from '../../business/constants'
import { BusinessInfoAnswers, OwnerAnswers } from '../../business/types'

type StepBusinessInformationProps = {
  owner: OwnerAnswers
  business: BusinessInfoAnswers
  onOwnerChange: (field: keyof OwnerAnswers, value: string) => void
  onBusinessChange: (field: keyof BusinessInfoAnswers, value: string) => void
}

export default function StepBusinessInformation({
  owner,
  business,
  onOwnerChange,
  onBusinessChange,
}: StepBusinessInformationProps) {
  return (
    <QuestionCard
      title="About You & Your Business"
      description="A few details to personalize your Business Financial Report Card™."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <TextInput
          label="First Name"
          name="firstName"
          value={owner.firstName}
          onChange={(value) => onOwnerChange('firstName', value)}
          placeholder="First name"
          required
        />
        <TextInput
          label="Last Name"
          name="lastName"
          value={owner.lastName}
          onChange={(value) => onOwnerChange('lastName', value)}
          placeholder="Last name"
          required
        />
        <TextInput
          label="Email"
          name="email"
          type="email"
          value={owner.email}
          onChange={(value) => onOwnerChange('email', value)}
          placeholder="you@email.com"
          required
        />
        <TextInput
          label="Phone"
          name="phone"
          type="tel"
          value={owner.phone}
          onChange={(value) => onOwnerChange('phone', value)}
          placeholder="(555) 555-5555"
          required
        />
        <TextInput
          label="Business Name"
          name="businessName"
          value={business.name}
          onChange={(value) => onBusinessChange('name', value)}
          placeholder="Business name"
          required
        />
        <SelectInput
          label="What does your business primarily do?"
          name="industry"
          value={business.industry}
          onChange={(value) => onBusinessChange('industry', value)}
          options={BUSINESS_INDUSTRY_OPTIONS}
          placeholder="Select industry"
          required
        />
        <SelectInput
          label="Years in Business"
          name="yearsInBusiness"
          value={business.yearsInBusiness}
          onChange={(value) => onBusinessChange('yearsInBusiness', value)}
          options={YEARS_IN_BUSINESS_OPTIONS}
          required
        />
        <SelectInput
          label="Full-Time Employees"
          name="employees"
          value={business.employees}
          onChange={(value) => onBusinessChange('employees', value)}
          options={EMPLOYEE_COUNT_OPTIONS}
          required
        />
        <SelectInput
          label="What is your approximate annual gross business revenue?"
          name="grossAnnualRevenue"
          value={business.grossAnnualRevenue}
          onChange={(value) => onBusinessChange('grossAnnualRevenue', value)}
          options={GROSS_ANNUAL_REVENUE_OPTIONS}
          required
        />
        <SelectInput
          label="How do you currently pay yourself from the business?"
          name="ownerCompensationMethod"
          value={business.ownerCompensationMethod}
          onChange={(value) => onBusinessChange('ownerCompensationMethod', value)}
          options={OWNER_COMPENSATION_METHOD_OPTIONS}
          required
        />
        <SelectInput
          label="Approximately how much do you personally receive from the business each year?"
          name="ownerPersonalIncome"
          value={business.ownerPersonalIncome}
          onChange={(value) => onBusinessChange('ownerPersonalIncome', value)}
          options={OWNER_PERSONAL_INCOME_OPTIONS}
          required
        />
      </form>
    </QuestionCard>
  )
}
