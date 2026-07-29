import type { SectionValidationResult } from '../onboardingValidation'

type Props = {
  result: SectionValidationResult
}

export default function SectionValidationSummary({ result }: Props) {
  const errorCount = Object.keys(result.errors).length
  const warningCount = Object.keys(result.warnings).length
  const missingCount = result.missingRequiredFields.length

  if (errorCount === 0 && warningCount === 0 && missingCount === 0) {
    if (result.status === 'complete') {
      return (
        <p className="crm-banner crm-banner-success" role="status">
          This section looks complete for draft progress.
        </p>
      )
    }
    return null
  }

  return (
    <div className="crm-onboarding-validation-summary" role="status">
      {errorCount > 0 ? (
        <p className="crm-banner crm-banner-error">
          {errorCount} validation issue{errorCount === 1 ? '' : 's'} need attention.
        </p>
      ) : null}
      {missingCount > 0 && result.status !== 'needs_attention' ? (
        <p className="crm-banner crm-banner-warning">
          {missingCount} required field{missingCount === 1 ? '' : 's'} still needed for section
          completion.
        </p>
      ) : null}
      {warningCount > 0 ? (
        <ul className="crm-onboarding-warning-list">
          {Object.values(result.warnings).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
