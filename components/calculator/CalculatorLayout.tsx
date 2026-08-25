import { ReactNode } from 'react'
import AssessmentBrandHeader from '../AssessmentBrandHeader'
import ProgressBar from '../assessment/ProgressBar'
import { CALCULATOR_TOTAL_STEPS } from './constants'

type CalculatorLayoutProps = {
  currentStep: number
  children: ReactNode
  footer?: ReactNode
  /** Optional localized chrome. Defaults keep the existing English copy. */
  title?: string
  subtitle?: string
  disclaimer?: string
  stepIndicator?: string
  headerExtra?: ReactNode
}

export default function CalculatorLayout({
  currentStep,
  children,
  footer,
  title = 'Family Protection Analysis™',
  subtitle = 'Find out how much life insurance your family may need in less than 2 minutes.',
  disclaimer = 'This calculator provides an educational estimate and is not an insurance quote.',
  stepIndicator,
  headerExtra,
}: CalculatorLayoutProps) {
  return (
    <div className="calculator-shell">
      <div className="calculator-container">
        <header className="calculator-header">
          <AssessmentBrandHeader />
          {headerExtra}
          <div className="calculator-intro">
            <h1 className="calculator-title">{title}</h1>
            <p className="calculator-subtitle">{subtitle}</p>
            <p className="calculator-disclaimer">{disclaimer}</p>
          </div>
          <p className="calculator-step-indicator">
            {stepIndicator ?? `Step ${currentStep} of ${CALCULATOR_TOTAL_STEPS}`}
          </p>
          <ProgressBar currentStep={currentStep} totalSteps={CALCULATOR_TOTAL_STEPS} />
        </header>

        <main className="calculator-main">{children}</main>

        {footer && <footer className="calculator-footer">{footer}</footer>}
      </div>
    </div>
  )
}
