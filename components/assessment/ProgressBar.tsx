type ProgressBarProps = {
  currentStep: number
  totalSteps: number
}

export default function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const progress = Math.min(100, Math.round((currentStep / totalSteps) * 100))

  return (
    <div
      className="assessment-progress"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Assessment progress: ${progress}%`}
    >
      <div className="assessment-progress-fill" style={{ width: `${progress}%` }} />
    </div>
  )
}
