import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import type { HouseholdFinancialProgressResult } from '../../../financial-progress'
import { formatLastCalculated } from './formatProgressDisplay'

type ProgressSnapshotCardProps = {
  progress: HouseholdFinancialProgressResult
}

export default function ProgressSnapshotCard({ progress }: ProgressSnapshotCardProps) {
  const { snapshot } = progress

  return (
    <Panel labelledBy="crm-fp-snapshot-heading">
      <SectionHeader title="Progress Snapshot" titleId="crm-fp-snapshot-heading" />
      <dl className="crm-client-workspace-info-list">
        <div>
          <dt>Methodology Version</dt>
          <dd>{snapshot.methodologyVersion}</dd>
        </div>
        <div>
          <dt>Last Calculated</dt>
          <dd>{formatLastCalculated(progress)}</dd>
        </div>
        <div>
          <dt>Engine Version</dt>
          <dd>{snapshot.engineVersion}</dd>
        </div>
        <div>
          <dt>Household ID</dt>
          <dd>{snapshot.householdId}</dd>
        </div>
        <div>
          <dt>Categories in Snapshot</dt>
          <dd>{snapshot.categories.length}</dd>
        </div>
        <div>
          <dt>Snapshot Status</dt>
          <dd>{snapshot.overall.status}</dd>
        </div>
      </dl>
    </Panel>
  )
}
