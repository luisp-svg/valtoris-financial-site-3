import { ReactNode } from 'react'
import BrandLogo from '../BrandLogo'
import ProgressBar from './ProgressBar'
import { DEMO_ASSESSMENT_STEPS } from './constants'

type AssessmentLayoutProps = {
  currentStep: number
  totalSteps?: number
  children: ReactNode
  footer?: ReactNode
}

export default function AssessmentLayout({
  currentStep,
  totalSteps = DEMO_ASSESSMENT_STEPS,
  children,
  footer,
}: AssessmentLayoutProps) {
  return (
    <div className="assessment-shell">
      <div className="assessment-container">
        <header className="assessment-header">
          <BrandLogo className="assessment-logo" />
          <p className="assessment-step-indicator">
            Step {currentStep} of {totalSteps}
          </p>
          <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
        </header>

        <main className="assessment-main">{children}</main>

        {footer && <footer className="assessment-footer">{footer}</footer>}
      </div>
    </div>
  )
}
