import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import { downloadPublicCardQr } from '../../components/digitalIdentity/downloadPublicCardQr'
import {
  CAMPAIGN_CODES_IMMUTABLE_COPY,
  CAMPAIGN_EDITABLE_FIELD_KEYS,
  CAMPAIGN_QR_FORMATS,
  campaignEditFormFromRow,
  type CampaignEditFormState,
  validateCampaignLifecycle,
} from '../../crm/campaigns/campaignEditContract'
import {
  buildCampaignPreviewDestination,
  buildCampaignPublicLink,
  createCrmCampaign,
  listCrmCampaigns,
  listPublishedCardsForCampaigns,
  softDeleteCrmCampaign,
  updateCrmCampaign,
  type CrmCampaignRow,
} from '../../crm/campaigns/campaignsApi'
import AdvisorDigitalCardPanel from '../../crm/digital-identity/AdvisorDigitalCardPanel'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import type { PublicCardQrFormat } from '../../modules/digital-identity'

type CardOption = { id: string; publicKey: string; slug: string; label: string }

const emptyForm = {
  digitalCardId: '',
  campaignCode: '',
  eventCode: '',
  label: '',
  description: '',
  locationLabel: '',
  organizer: '',
  advisorNotes: '',
  startsAt: '',
  endsAt: '',
}

function toIsoOrNull(localValue: string): string | null {
  if (!localValue.trim()) return null
  const ms = Date.parse(localValue)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString()
}

export default function CrmCampaignsPage() {
  const { user, role } = useCrmAuth()
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [campaigns, setCampaigns] = useState<CrmCampaignRow[]>([])
  const [cards, setCards] = useState<CardOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<CampaignEditFormState | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [list, cardList] = await Promise.all([
      listCrmCampaigns(supabase),
      listPublishedCardsForCampaigns(supabase),
    ])
    if (!list.ok) setError(list.message)
    else setCampaigns(list.campaigns)
    if (cardList.ok) {
      setCards(cardList.cards)
      setForm((prev) =>
        prev.digitalCardId || !cardList.cards[0]
          ? prev
          : { ...prev, digitalCardId: cardList.cards[0].id },
      )
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return
    const startsAt = toIsoOrNull(form.startsAt)
    const endsAt = toIsoOrNull(form.endsAt)
    const lifecycleError = validateCampaignLifecycle(startsAt, endsAt)
    if (lifecycleError) {
      setError(lifecycleError)
      return
    }
    setSaving(true)
    setMessage(null)
    setError(null)
    const result = await createCrmCampaign(
      supabase,
      {
        digitalCardId: form.digitalCardId,
        campaignCode: form.campaignCode,
        eventCode: form.eventCode || null,
        label: form.label,
        description: form.description || null,
        locationLabel: form.locationLabel || null,
        organizer: form.organizer || null,
        advisorNotes: form.advisorNotes || null,
        startsAt,
        endsAt,
      },
      user.id,
    )
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setMessage('Campaign created.')
    setForm((prev) => ({
      ...emptyForm,
      digitalCardId: prev.digitalCardId,
    }))
    await reload()
  }

  function beginEdit(campaign: CrmCampaignRow) {
    setEditingId(campaign.id)
    setEditForm(campaignEditFormFromRow(campaign))
    setMessage(null)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  async function handleSaveEdit(campaign: CrmCampaignRow) {
    if (!editForm) return
    const startsAt = toIsoOrNull(editForm.startsAt)
    const endsAt = toIsoOrNull(editForm.endsAt)
    const lifecycleError = validateCampaignLifecycle(startsAt, endsAt)
    if (lifecycleError) {
      setError(lifecycleError)
      return
    }
    if (!editForm.label.trim()) {
      setError('Label is required.')
      return
    }
    setEditSaving(true)
    setError(null)
    setMessage(null)
    const result = await updateCrmCampaign(supabase, campaign.id, {
      label: editForm.label,
      description: editForm.description || null,
      locationLabel: editForm.locationLabel || null,
      organizer: editForm.organizer || null,
      advisorNotes: editForm.advisorNotes || null,
      startsAt,
      endsAt,
    })
    setEditSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setMessage('Campaign updated.')
    cancelEdit()
    await reload()
  }

  async function copyLink(campaign: CrmCampaignRow) {
    const link = `${window.location.origin}${buildCampaignPublicLink(campaign)}`
    try {
      await navigator.clipboard.writeText(link)
      setMessage('Campaign link copied.')
    } catch {
      setError('Unable to copy link.')
    }
  }

  async function downloadQr(campaign: CrmCampaignRow, format: PublicCardQrFormat) {
    setError(null)
    const result = await downloadPublicCardQr({
      key: campaign.cardPublicKey,
      format,
      campaignCode: campaign.campaignCode,
      eventCode: campaign.eventCode,
    })
    if (!result.ok) {
      setError(result.message)
      return
    }
    if (result.destinationUrl) {
      if (
        result.destinationUrl.includes('/c/') &&
        !result.destinationUrl.includes('/c/k/')
      ) {
        setError('Unable to download campaign QR.')
        return
      }
    }
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename
    a.click()
    URL.revokeObjectURL(url)
    const label =
      format === 'png-hires' ? 'Print PNG' : format === 'png' ? 'PNG' : 'SVG'
    setMessage(`Campaign QR (${label}) downloaded.`)
  }

  return (
    <div className="crm-page">
      <header className="crm-page-header">
        <h1>Campaigns</h1>
        <p className="crm-muted">
          Create and edit campaign and event links for Digital Identity cards. Attribution is
          captured when visitors complete Let’s Connect. Role: {role || 'advisor'}.
        </p>
        <p className="crm-muted" data-testid="crm-campaigns-auth-note">
          Page access uses CRM authentication. Campaign data visibility is enforced by existing RLS
          (advisor own-card, owner all). Capability-key UI gating is not part of Sprint 5.9 runtime
          authorization.
        </p>
      </header>

      {user ? (
        <AdvisorDigitalCardPanel supabase={supabase} userId={user.id} onPublished={() => void reload()} />
      ) : null}

      {error ? (
        <p className="crm-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="crm-success" role="status">
          {message}
        </p>
      ) : null}

      <section className="crm-panel" aria-labelledby="crm-campaign-create-title">
        <h2 id="crm-campaign-create-title">Create campaign / event</h2>
        <form className="crm-form" onSubmit={(e) => void handleCreate(e)}>
          <label>
            Card
            <select
              value={form.digitalCardId}
              onChange={(e) => setForm((p) => ({ ...p, digitalCardId: e.target.value }))}
              required
            >
              <option value="">Select published card</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Campaign code
            <input
              value={form.campaignCode}
              onChange={(e) => setForm((p) => ({ ...p, campaignCode: e.target.value }))}
              required
              maxLength={64}
              placeholder="rr-chamber-2026"
            />
          </label>
          <label>
            Event code (optional)
            <input
              value={form.eventCode}
              onChange={(e) => setForm((p) => ({ ...p, eventCode: e.target.value }))}
              maxLength={64}
              placeholder="breakfast-aug-12"
            />
          </label>
          <label>
            Label
            <input
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              required
              maxLength={160}
              placeholder="Round Rock Chamber Breakfast"
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              maxLength={1000}
              rows={3}
            />
          </label>
          <label>
            Location
            <input
              value={form.locationLabel}
              onChange={(e) => setForm((p) => ({ ...p, locationLabel: e.target.value }))}
              maxLength={200}
            />
          </label>
          <label>
            Organizer
            <input
              value={form.organizer}
              onChange={(e) => setForm((p) => ({ ...p, organizer: e.target.value }))}
              maxLength={200}
            />
          </label>
          <label>
            Advisor notes (private)
            <textarea
              value={form.advisorNotes}
              onChange={(e) => setForm((p) => ({ ...p, advisorNotes: e.target.value }))}
              maxLength={2000}
              rows={2}
            />
          </label>
          <label>
            Starts
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
            />
          </label>
          <label>
            Ends
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
            />
          </label>
          <button type="submit" className="platform-btn platform-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Create campaign'}
          </button>
        </form>
      </section>

      <section className="crm-panel" aria-labelledby="crm-campaign-list-title">
        <h2 id="crm-campaign-list-title">Your campaigns</h2>
        {/* Contract marker for automated edit-field coverage */}
        <p className="crm-muted" hidden data-testid="crm-campaign-editable-fields">
          {CAMPAIGN_EDITABLE_FIELD_KEYS.join(',')}
        </p>
        {loading ? <p className="crm-muted">Loading…</p> : null}
        {!loading && campaigns.length === 0 ? (
          <p className="crm-muted">No campaigns yet.</p>
        ) : null}
        <ul className="crm-list">
          {campaigns.map((campaign) => {
            const isEditing = editingId === campaign.id && editForm
            return (
              <li key={campaign.id} className="crm-list-item" data-campaign-code={campaign.campaignCode}>
                <div>
                  <strong>{campaign.label}</strong>
                  <p className="crm-muted">
                    {campaign.campaignCode}
                    {campaign.eventCode ? ` · ${campaign.eventCode}` : ''} · {campaign.status}
                    {campaign.advisorDisplayName ? ` · ${campaign.advisorDisplayName}` : ''}
                  </p>
                  <p className="crm-muted">Preview: {buildCampaignPreviewDestination(campaign)}</p>
                  {campaign.advisorNotes && !isEditing ? (
                    <p className="crm-muted">Notes: {campaign.advisorNotes}</p>
                  ) : null}

                  {isEditing ? (
                    <form
                      className="crm-form"
                      data-testid={`crm-campaign-edit-form-${campaign.campaignCode}`}
                      onSubmit={(e) => {
                        e.preventDefault()
                        void handleSaveEdit(campaign)
                      }}
                    >
                      <p className="crm-muted" data-testid="crm-campaign-codes-immutable-note">
                        {CAMPAIGN_CODES_IMMUTABLE_COPY}
                      </p>
                      <label>
                        Campaign code
                        <input
                          value={campaign.campaignCode}
                          readOnly
                          aria-readonly="true"
                          data-testid="crm-campaign-edit-campaign-code"
                        />
                      </label>
                      <label>
                        Event code
                        <input
                          value={campaign.eventCode || ''}
                          readOnly
                          aria-readonly="true"
                          data-testid="crm-campaign-edit-event-code"
                          placeholder="(none)"
                        />
                      </label>
                      <label>
                        Card
                        <input
                          value={
                            campaign.advisorDisplayName
                              ? `${campaign.advisorDisplayName} (${campaign.cardSlug})`
                              : campaign.cardSlug
                          }
                          readOnly
                          aria-readonly="true"
                        />
                      </label>
                      <label>
                        Label
                        <input
                          value={editForm.label}
                          onChange={(e) =>
                            setEditForm((p) => (p ? { ...p, label: e.target.value } : p))
                          }
                          required
                          maxLength={160}
                          data-testid="crm-campaign-edit-label"
                        />
                      </label>
                      <label>
                        Description
                        <textarea
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm((p) => (p ? { ...p, description: e.target.value } : p))
                          }
                          maxLength={1000}
                          rows={3}
                          data-testid="crm-campaign-edit-description"
                        />
                      </label>
                      <label>
                        Location
                        <input
                          value={editForm.locationLabel}
                          onChange={(e) =>
                            setEditForm((p) => (p ? { ...p, locationLabel: e.target.value } : p))
                          }
                          maxLength={200}
                          data-testid="crm-campaign-edit-location"
                        />
                      </label>
                      <label>
                        Organizer
                        <input
                          value={editForm.organizer}
                          onChange={(e) =>
                            setEditForm((p) => (p ? { ...p, organizer: e.target.value } : p))
                          }
                          maxLength={200}
                          data-testid="crm-campaign-edit-organizer"
                        />
                      </label>
                      <label>
                        Advisor notes (private)
                        <textarea
                          value={editForm.advisorNotes}
                          onChange={(e) =>
                            setEditForm((p) => (p ? { ...p, advisorNotes: e.target.value } : p))
                          }
                          maxLength={2000}
                          rows={2}
                          data-testid="crm-campaign-edit-advisor-notes"
                        />
                      </label>
                      <label>
                        Starts
                        <input
                          type="datetime-local"
                          value={editForm.startsAt}
                          onChange={(e) =>
                            setEditForm((p) => (p ? { ...p, startsAt: e.target.value } : p))
                          }
                          data-testid="crm-campaign-edit-starts"
                        />
                      </label>
                      <label>
                        Ends
                        <input
                          type="datetime-local"
                          value={editForm.endsAt}
                          onChange={(e) =>
                            setEditForm((p) => (p ? { ...p, endsAt: e.target.value } : p))
                          }
                          data-testid="crm-campaign-edit-ends"
                        />
                      </label>
                      <div className="crm-actions">
                        <button
                          type="submit"
                          className="platform-btn platform-btn-primary"
                          disabled={editSaving}
                        >
                          {editSaving ? 'Saving…' : 'Save changes'}
                        </button>
                        <button
                          type="button"
                          className="platform-btn platform-btn-outline"
                          onClick={cancelEdit}
                          disabled={editSaving}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
                <div className="crm-actions">
                  {!isEditing ? (
                    <button
                      type="button"
                      className="platform-btn platform-btn-secondary"
                      onClick={() => beginEdit(campaign)}
                      aria-label={`Edit campaign ${campaign.label}`}
                    >
                      Edit
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="platform-btn platform-btn-secondary"
                    onClick={() => void copyLink(campaign)}
                    aria-label={`Copy link for ${campaign.label}`}
                  >
                    Copy link
                  </button>
                  {CAMPAIGN_QR_FORMATS.map((item) => (
                    <button
                      key={item.format}
                      type="button"
                      className="platform-btn platform-btn-secondary"
                      onClick={() => void downloadQr(campaign, item.format)}
                      aria-label={`Download ${item.label} QR for ${campaign.label}`}
                      data-testid={`crm-campaign-qr-${item.format}`}
                    >
                      QR {item.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="platform-btn platform-btn-outline"
                    onClick={() =>
                      void updateCrmCampaign(supabase, campaign.id, {
                        status: campaign.status === 'active' ? 'disabled' : 'active',
                      }).then((r) => {
                        if (!r.ok) setError(r.message)
                        else void reload()
                      })
                    }
                    aria-label={
                      campaign.status === 'active'
                        ? `Disable campaign ${campaign.label}`
                        : `Activate campaign ${campaign.label}`
                    }
                  >
                    {campaign.status === 'active' ? 'Disable' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    className="platform-btn platform-btn-outline"
                    onClick={() =>
                      void softDeleteCrmCampaign(supabase, campaign.id).then((r) => {
                        if (!r.ok) setError(r.message)
                        else void reload()
                      })
                    }
                    aria-label={`Archive campaign ${campaign.label}`}
                  >
                    Archive
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
