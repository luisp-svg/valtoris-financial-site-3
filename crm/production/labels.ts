import type {
  ProductionDeliveryStatus,
  ProductionDisposition,
  ProductionEntryStage,
  ProductionParticipantRole,
  ProductionPremiumMode,
  ProductionProductLine,
  ProductionStage,
} from './types'

const STAGE_LABELS: Record<ProductionStage, string> = {
  draft: 'Draft',
  pre_submitted: 'Pre-submitted',
  submitted: 'Submitted',
  in_underwriting: 'In underwriting',
  approved: 'Approved',
  declined: 'Declined',
  postponed: 'Postponed',
  withdrawn: 'Withdrawn',
  incomplete: 'Incomplete',
  not_taken: 'Not taken',
  issued: 'Issued',
  in_force: 'In force',
}

const PRODUCT_LINE_LABELS: Record<ProductionProductLine, string> = {
  life_term: 'Life — Term',
  life_permanent: 'Life — Permanent / IUL',
  fia: 'FIA',
}

/** Catalog form/list labels (P1B-2A). Queue keeps the shorter P1B-1 labels. */
const CATALOG_PRODUCT_LINE_LABELS: Record<ProductionProductLine, string> = {
  life_term: 'Term Life',
  life_permanent: 'Permanent Life / IUL',
  fia: 'Fixed Indexed Annuity',
}

const DISPOSITION_LABELS: Record<ProductionDisposition, string> = {
  pending: 'Pending',
  approved_as_applied: 'Approved as applied',
  approved_other_than_applied: 'Approved other than applied',
  approved_with_amendment: 'Approved with amendment',
  declined: 'Declined',
  postponed: 'Postponed',
}

const DELIVERY_LABELS: Record<ProductionDeliveryStatus, string> = {
  pre_issue: 'Pre-issue',
  not_started: 'Not started',
  with_agent: 'With agent',
  with_client: 'With client',
  requirements_pending: 'Requirements pending',
  complete: 'Complete',
  not_required: 'Not required',
}

const PREMIUM_MODE_LABELS: Record<ProductionPremiumMode, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-annual',
  annual: 'Annual',
  single: 'Single',
  other: 'Other',
}

const ENTRY_STAGE_LABELS: Record<ProductionEntryStage, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  in_underwriting: 'In underwriting',
}

const PARTICIPANT_ROLE_LABELS: Record<ProductionParticipantRole, string> = {
  primary_client: 'Primary client',
  insured: 'Insured',
  owner: 'Owner',
  joint_owner: 'Joint owner',
  annuitant: 'Annuitant',
  payor: 'Payor',
}

export function formatProductionStageLabel(stage: string | null | undefined): string {
  if (!stage) return '—'
  return STAGE_LABELS[stage as ProductionStage] ?? stage
}

export function formatProductionProductLineLabel(line: string | null | undefined): string {
  if (!line) return '—'
  return PRODUCT_LINE_LABELS[line as ProductionProductLine] ?? line
}

export function formatCatalogProductLineLabel(line: string | null | undefined): string {
  if (!line) return '—'
  return CATALOG_PRODUCT_LINE_LABELS[line as ProductionProductLine] ?? line
}

export function formatProductionDispositionLabel(value: string | null | undefined): string {
  if (!value) return '—'
  return DISPOSITION_LABELS[value as ProductionDisposition] ?? value
}

export function formatProductionDeliveryLabel(value: string | null | undefined): string {
  if (!value) return '—'
  return DELIVERY_LABELS[value as ProductionDeliveryStatus] ?? value
}

export function formatProductionPremiumModeLabel(value: string | null | undefined): string {
  if (!value) return '—'
  return PREMIUM_MODE_LABELS[value as ProductionPremiumMode] ?? value
}

export function formatProductionEntryStageLabel(value: string | null | undefined): string {
  if (!value) return '—'
  return ENTRY_STAGE_LABELS[value as ProductionEntryStage] ?? value
}

export function formatProductionParticipantRoleLabel(role: string | null | undefined): string {
  if (!role) return '—'
  return PARTICIPANT_ROLE_LABELS[role as ProductionParticipantRole] ?? role
}

/** Short queue badge for Life Permanent / IUL. */
export function formatProductionProductLineShort(line: string | null | undefined): string {
  if (line === 'life_term') return 'Term'
  if (line === 'life_permanent') return 'IUL / Permanent'
  if (line === 'fia') return 'FIA'
  return formatProductionProductLineLabel(line)
}
