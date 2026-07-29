import EmptyState from '../../../components/ui/EmptyState'
import { createClientId, formatCentsCurrency } from '../onboardingMoney'
import {
  emptyAssetItem,
  type HouseholdOnboardingAnswers,
  type OnboardingAssetItem,
  type OnboardingAssetsAnswers,
} from '../onboardingFormTypes'
import type { OnboardingSectionConfig } from '../onboardingSections'
import {
  computeKnownAssetTotalCents,
  validateAssetsSection,
} from '../onboardingValidation'
import MoneyField from './MoneyField'
import SectionValidationSummary from './SectionValidationSummary'

type Props = {
  section: OnboardingSectionConfig
  answers: HouseholdOnboardingAnswers
  readOnly: boolean
  onChangeAssets: (
    assets: OnboardingAssetsAnswers | ((prev: OnboardingAssetsAnswers) => OnboardingAssetsAnswers),
  ) => void
}

export default function AssetsSavingsSection({
  section,
  answers,
  readOnly,
  onChangeAssets,
}: Props) {
  const assets = answers.assets
  const validation = validateAssetsSection(answers)
  const total = computeKnownAssetTotalCents(answers)

  function updateItem(id: string, partial: Partial<OnboardingAssetItem>) {
    onChangeAssets((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...partial } : item)),
    }))
  }

  return (
    <section className="crm-onboarding-section" aria-labelledby={`crm-onboarding-section-${section.id}-title`}>
      <h2 id={`crm-onboarding-section-${section.id}-title`} className="crm-panel-title">
        {section.title}
      </h2>
      <p className="crm-muted">{section.description}</p>
      <SectionValidationSummary result={validation} />

      <label className="crm-field crm-onboarding-checkbox">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={assets.noAssets}
          onChange={(e) =>
            onChangeAssets((prev) => ({ ...prev, noAssets: e.target.checked }))
          }
        />
        Household reports no assets to capture
      </label>

      {!readOnly ? (
        <button
          type="button"
          className="crm-secondary-btn"
          disabled={assets.noAssets}
          onClick={() =>
            onChangeAssets((prev) => ({
              ...prev,
              noAssets: false,
              items: [...prev.items, emptyAssetItem({ id: createClientId() })],
            }))
          }
        >
          + Add asset
        </button>
      ) : null}

      {assets.items.length === 0 ? (
        <EmptyState
          title="No assets listed"
          description={
            assets.noAssets
              ? 'Marked as no assets.'
              : 'Add assets or acknowledge that none apply.'
          }
        />
      ) : (
        <div className="crm-onboarding-repeatable-list">
          {assets.items.map((item, index) => (
            <fieldset key={item.id} className="crm-onboarding-repeatable-card" disabled={readOnly}>
              <legend>Asset {index + 1}</legend>
              <div className="crm-onboarding-form-grid">
                <label className="crm-field">
                  Category *
                  <select
                    value={item.category}
                    onChange={(e) =>
                      updateItem(item.id, {
                        category: e.target.value as OnboardingAssetItem['category'],
                      })
                    }
                  >
                    <option value="">Select…</option>
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="high_yield_savings">High-yield savings</option>
                    <option value="emergency_fund">Emergency fund</option>
                    <option value="brokerage">Brokerage</option>
                    <option value="retirement_account">Retirement account</option>
                    <option value="hsa">HSA</option>
                    <option value="real_estate">Real estate</option>
                    <option value="business_ownership">Business ownership</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="crm-field">
                  Description / institution
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  />
                </label>
                <MoneyField
                  label="Approximate balance / value"
                  name={`${item.id}-balance`}
                  value={item.balanceCents}
                  onChange={(cents) => updateItem(item.id, { balanceCents: cents })}
                  hint="Blank = unknown. Values are client-provided estimates unless noted."
                />
                <label className="crm-field">
                  Ownership
                  <input
                    value={item.ownership}
                    onChange={(e) => updateItem(item.id, { ownership: e.target.value })}
                  />
                </label>
                <label className="crm-field">
                  Liquidity
                  <select
                    value={item.liquidity}
                    onChange={(e) =>
                      updateItem(item.id, {
                        liquidity: e.target.value as OnboardingAssetItem['liquidity'],
                      })
                    }
                  >
                    <option value="">Select…</option>
                    <option value="liquid">Liquid</option>
                    <option value="mixed">Mixed</option>
                    <option value="illiquid">Illiquid</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
                <label className="crm-field">
                  Value status
                  <select
                    value={item.valueStatus}
                    onChange={(e) =>
                      updateItem(item.id, {
                        valueStatus: e.target.value as OnboardingAssetItem['valueStatus'],
                      })
                    }
                  >
                    <option value="estimated">Estimated</option>
                    <option value="client_provided">Client-provided</option>
                  </select>
                </label>
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  className="crm-text-btn-danger"
                  onClick={() => {
                    if (!window.confirm('Remove this asset?')) return
                    onChangeAssets((prev) => ({
                      ...prev,
                      items: prev.items.filter((row) => row.id !== item.id),
                    }))
                  }}
                >
                  Remove asset
                </button>
              ) : null}
            </fieldset>
          ))}
        </div>
      )}

      <p className="crm-muted">
        Estimated total of known balances: {formatCentsCurrency(total)} (excludes unknown
        balances; not verified).
      </p>

      <label className="crm-field">
        Notes
        <textarea
          disabled={readOnly}
          rows={3}
          value={assets.notes}
          onChange={(e) => onChangeAssets((prev) => ({ ...prev, notes: e.target.value }))}
        />
      </label>
    </section>
  )
}
