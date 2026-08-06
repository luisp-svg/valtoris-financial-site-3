import type { DuplicateMatch } from './types'

export type DuplicateCollisionModalProps = {
  open: boolean
  matches: DuplicateMatch[]
  hasRestrictedCollision: boolean
  busy?: boolean
  /** Opens an accessible Manual Contact; parent resolves household → lead. */
  onOpenExisting: (householdId: string) => void
  onCreateSeparate: () => void
  onCancel: () => void
}

/**
 * Safe duplicate acknowledgment modal.
 * Restricted matches never expose IDs, PII, or Open existing.
 */
export default function DuplicateCollisionModal({
  open,
  matches,
  hasRestrictedCollision,
  busy = false,
  onOpenExisting,
  onCreateSeparate,
  onCancel,
}: DuplicateCollisionModalProps) {
  if (!open) return null

  const accessible = matches.filter((m) => m.visibility === 'accessible' && m.householdId)
  const showRestrictedOnly = hasRestrictedCollision && accessible.length === 0

  return (
    <div className="crm-intake-dialog-backdrop" role="presentation">
      <div
        className="crm-panel crm-intake-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-duplicate-title"
      >
        <h2 id="contact-duplicate-title" className="crm-page-title">
          Possible existing contact
        </h2>

        {showRestrictedOnly ? (
          <p className="crm-page-subtitle">
            A possible existing contact was found. Contact an owner or create a separate record if
            appropriate.
          </p>
        ) : (
          <>
            <p className="crm-page-subtitle">
              We found possible matches. Review them before creating a separate contact.
            </p>
            <ul className="crm-contacts-match-list">
              {accessible.map((match) => (
                <li key={`${match.householdId}-${match.matchClass}`}>
                  <div>
                    <strong>{match.displayName ?? 'Existing contact'}</strong>
                    <span className="crm-muted"> · {match.matchClassLabel}</span>
                  </div>
                  <div className="crm-muted">
                    {[match.maskedEmail, match.maskedPhone].filter(Boolean).join(' · ')}
                  </div>
                  {match.householdId ? (
                    <button
                      type="button"
                      className="crm-text-btn"
                      disabled={busy}
                      onClick={() => onOpenExisting(match.householdId!)}
                    >
                      Open existing
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {hasRestrictedCollision ? (
              <p className="crm-banner crm-banner-warning" role="status">
                Another possible match may exist that you cannot view. Contact an owner if needed.
              </p>
            ) : null}
          </>
        )}

        <div className="crm-form-actions">
          <button
            type="button"
            className="crm-primary-btn"
            disabled={busy}
            onClick={onCreateSeparate}
          >
            Create separate
          </button>
          <button type="button" className="crm-secondary-btn" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
