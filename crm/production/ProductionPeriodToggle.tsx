import {
  productionDashboardPeriodLabel,
  type DashboardReportingPeriod,
} from './dashboardPeriod'

type ProductionPeriodToggleProps = {
  value: DashboardReportingPeriod
  onChange: (next: DashboardReportingPeriod) => void
  options: readonly DashboardReportingPeriod[]
  ariaLabel: string
}

export default function ProductionPeriodToggle({
  value,
  onChange,
  options,
  ariaLabel,
}: ProductionPeriodToggleProps) {
  return (
    <div className="crm-production-period-toggle" role="group" aria-label={ariaLabel}>
      {options.map((period) => (
        <button
          key={period}
          type="button"
          className={value === period ? 'is-active' : undefined}
          aria-pressed={value === period}
          onClick={() => onChange(period)}
        >
          {productionDashboardPeriodLabel(period)}
        </button>
      ))}
    </div>
  )
}
