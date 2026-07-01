type NavigationButtonsProps = {
  onBack: () => void
  onContinue: () => void
  continueDisabled?: boolean
  backLabel?: string
  continueLabel?: string
}

export default function NavigationButtons({
  onBack,
  onContinue,
  continueDisabled = false,
  backLabel = 'Back',
  continueLabel = 'Continue',
}: NavigationButtonsProps) {
  return (
    <div className="assessment-nav">
      <button type="button" className="assessment-btn assessment-btn-secondary" onClick={onBack}>
        {backLabel}
      </button>
      <button
        type="button"
        className="assessment-btn assessment-btn-primary"
        onClick={onContinue}
        disabled={continueDisabled}
      >
        {continueLabel}
      </button>
    </div>
  )
}
