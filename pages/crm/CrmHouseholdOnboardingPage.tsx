import { useParams } from 'react-router-dom'
import HouseholdOnboardingPage from '../../crm/households/onboarding/HouseholdOnboardingPage'

/**
 * Route entry for Household Onboarding.
 * Domain UI lives in `crm/households/onboarding`.
 */
export default function CrmHouseholdOnboardingPage() {
  const { householdId } = useParams<{ householdId: string }>()
  return <HouseholdOnboardingPage householdId={householdId} />
}
