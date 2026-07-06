import { ReactNode } from 'react'
import BrandLogo from '../BrandLogo'
import ProgressBar from '../assessment/ProgressBar'
import { CALCULATOR_TOTAL_STEPS } from './constants'

type CalculatorLayoutProps = {
  currentStep: number
  children: ReactNode
  footer?: ReactNode
}

export default function CalculatorLayout({ currentStep, children, footer }: CalculatorLayoutProps) {
  return (
    <div className="calculator-shell">
      <div className="calculator-container">
        <header className="calculator-header">
          <BrandLogo className="calculator-logo" />
          <div className="calculator-intro">
            <h1 className="calculator-title">Family Protection Analysis™</h1>
            <p className="calculator-subtitle">
              Find out how much life insurance your family may need in less than 2 minutes.
            </p>
            <p className="calculator-disclaimer">
              This calculator provides an educational estimate and is not an insurance quote.
            </p>
          </div>
          <p className="calculator-step-indicator">
            Step {currentStep} of {CALCULATOR_TOTAL_STEPS}
          </p>
          <ProgressBar currentStep={currentStep} totalSteps={CALCULATOR_TOTAL_STEPS} />
        </header>

        <main className="calculator-main">{children}</main>

        {footer && <footer className="calculator-footer">{footer}</footer>}
      </div>
    </div>
  )
}
