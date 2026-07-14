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
      <button type="button" className="platform-btn platform-btn-outline" onClick={onBack}>
        {backLabel}
      </button>
      <button
        type="button"
        className="platform-btn platform-btn-primary"
        onClick={onContinue}
        disabled={continueDisabled}
      >
        {continueLabel}
      </button>
    </div>
  )
}
