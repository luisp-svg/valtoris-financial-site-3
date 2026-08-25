import QuestionCard from '../../QuestionCard'
import SelectInput from '../../SelectInput'
import TextInput from '../../TextInput'
import { localizedOptions, type ReportCardCopyFn } from '../../reportCardLocale'
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
  t: ReportCardCopyFn
}

export default function StepBusinessInformation({
  owner,
  business,
  onOwnerChange,
  onBusinessChange,
  t,
}: StepBusinessInformationProps) {
  return (
    <QuestionCard title={t('ui', 'step2Title')} description={t('helpers', 'step2')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <TextInput
          label={t('fields', 'firstName')}
          name="firstName"
          value={owner.firstName}
          onChange={(value) => onOwnerChange('firstName', value)}
          placeholder={t('placeholders', 'firstName')}
          required
        />
        <TextInput
          label={t('fields', 'lastName')}
          name="lastName"
          value={owner.lastName}
          onChange={(value) => onOwnerChange('lastName', value)}
          placeholder={t('placeholders', 'lastName')}
          required
        />
        <TextInput
          label={t('fields', 'email')}
          name="email"
          type="email"
          value={owner.email}
          onChange={(value) => onOwnerChange('email', value)}
          placeholder={t('placeholders', 'email')}
          required
        />
        <TextInput
          label={t('fields', 'phone')}
          name="phone"
          type="tel"
          value={owner.phone}
          onChange={(value) => onOwnerChange('phone', value)}
          placeholder={t('placeholders', 'phone')}
          required
        />
        <TextInput
          label={t('fields', 'businessName')}
          name="businessName"
          value={business.name}
          onChange={(value) => onBusinessChange('name', value)}
          placeholder={t('placeholders', 'businessName')}
          required
        />
        <SelectInput
          label={t('fields', 'industry')}
          name="industry"
          value={business.industry}
          onChange={(value) => onBusinessChange('industry', value)}
          options={localizedOptions(BUSINESS_INDUSTRY_OPTIONS, t, 'industry')}
          placeholder={t('placeholders', 'industry')}
          required
        />
        <SelectInput
          label={t('fields', 'yearsInBusiness')}
          name="yearsInBusiness"
          value={business.yearsInBusiness}
          onChange={(value) => onBusinessChange('yearsInBusiness', value)}
          options={localizedOptions(YEARS_IN_BUSINESS_OPTIONS, t, 'yearsInBusiness')}
          required
        />
        <SelectInput
          label={t('fields', 'employees')}
          name="employees"
          value={business.employees}
          onChange={(value) => onBusinessChange('employees', value)}
          options={localizedOptions(EMPLOYEE_COUNT_OPTIONS, t, 'employees')}
          required
        />
        <SelectInput
          label={t('fields', 'grossAnnualRevenue')}
          name="grossAnnualRevenue"
          value={business.grossAnnualRevenue}
          onChange={(value) => onBusinessChange('grossAnnualRevenue', value)}
          options={localizedOptions(GROSS_ANNUAL_REVENUE_OPTIONS, t, 'grossAnnualRevenue')}
          required
        />
        <SelectInput
          label={t('fields', 'ownerCompensationMethod')}
          name="ownerCompensationMethod"
          value={business.ownerCompensationMethod}
          onChange={(value) => onBusinessChange('ownerCompensationMethod', value)}
          options={localizedOptions(
            OWNER_COMPENSATION_METHOD_OPTIONS,
            t,
            'ownerCompensationMethod',
          )}
          required
        />
        <SelectInput
          label={t('fields', 'ownerPersonalIncome')}
          name="ownerPersonalIncome"
          value={business.ownerPersonalIncome}
          onChange={(value) => onBusinessChange('ownerPersonalIncome', value)}
          options={localizedOptions(OWNER_PERSONAL_INCOME_OPTIONS, t, 'ownerPersonalIncome')}
          required
        />
      </form>
    </QuestionCard>
  )
}
