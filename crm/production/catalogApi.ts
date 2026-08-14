/**
 * P1B-2A catalog API.
 * Reads: SELECT only.
 * Writes: the four approved Migration 032 RPCs — never table INSERT/UPDATE/UPSERT/DELETE.
 */

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { formatCatalogUserError } from './catalogErrors'
import { PRODUCTION_PRODUCT_LINES, type CatalogCarrier, type CatalogProduct, type ProductionProductLine } from './types'

const CATALOG_RPC = {
  createCarrier: 'create_carrier',
  updateCarrier: 'update_carrier',
  createProduct: 'create_insurance_product',
  updateProduct: 'update_insurance_product',
} as const

export const APPROVED_CATALOG_RPCS = [
  CATALOG_RPC.createCarrier,
  CATALOG_RPC.updateCarrier,
  CATALOG_RPC.createProduct,
  CATALOG_RPC.updateProduct,
] as const

export type CatalogMutationResult<T> =
  | { ok: true; record: T }
  | { ok: false; message: string }

type RawCarrierRow = {
  id?: unknown
  code?: unknown
  name?: unknown
  is_active?: unknown
  created_at?: unknown
  updated_at?: unknown
  deleted_at?: unknown
}

type RawProductRow = {
  id?: unknown
  carrier_id?: unknown
  name?: unknown
  product_line?: unknown
  is_active?: unknown
  created_at?: unknown
  updated_at?: unknown
  deleted_at?: unknown
}

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data) return null
  if (Array.isArray(data)) {
    const first = data[0]
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null
  }
  if (typeof data === 'object') return data as Record<string, unknown>
  return null
}

function isProductLine(value: unknown): value is ProductionProductLine {
  return typeof value === 'string' && (PRODUCTION_PRODUCT_LINES as readonly string[]).includes(value)
}

function mapCarrier(row: RawCarrierRow | null | undefined): CatalogCarrier | null {
  if (!row?.id || row.deleted_at) return null
  return {
    id: String(row.id),
    code: String(row.code ?? ''),
    name: String(row.name ?? ''),
    is_active: row.is_active !== false,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

function mapProduct(row: RawProductRow | null | undefined): CatalogProduct | null {
  if (!row?.id || row.deleted_at || !isProductLine(row.product_line)) return null
  return {
    id: String(row.id),
    carrier_id: String(row.carrier_id ?? ''),
    name: String(row.name ?? ''),
    product_line: row.product_line,
    is_active: row.is_active !== false,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

export function formatCatalogDevError(context: string, err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const pg = err as PostgrestError
    return `[${context}] ${pg.message}${pg.code ? ` (${pg.code})` : ''}`
  }
  return `[${context}] ${String(err)}`
}

export async function fetchCatalogCarriers(supabase: SupabaseClient): Promise<CatalogCarrier[]> {
  const { data, error } = await supabase
    .from('carriers')
    .select('id, code, name, is_active, created_at, updated_at, deleted_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? [])
    .map((row) => mapCarrier(row as RawCarrierRow))
    .filter((row): row is CatalogCarrier => row != null)
}

export async function fetchCatalogProducts(supabase: SupabaseClient): Promise<CatalogProduct[]> {
  const { data, error } = await supabase
    .from('insurance_products')
    .select('id, carrier_id, name, product_line, is_active, created_at, updated_at, deleted_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? [])
    .map((row) => mapProduct(row as RawProductRow))
    .filter((row): row is CatalogProduct => row != null)
}

function mutationFailure(err: unknown): CatalogMutationResult<never> {
  return { ok: false, message: formatCatalogUserError(err) }
}

export async function createCarrier(
  supabase: SupabaseClient,
  input: { code: string; name: string },
): Promise<CatalogMutationResult<CatalogCarrier>> {
  const { data, error } = await supabase.rpc(CATALOG_RPC.createCarrier, {
    p_code: input.code.trim(),
    p_name: input.name.trim(),
  })
  if (error) return mutationFailure(error)
  const mapped = mapCarrier(asRecord(data) as RawCarrierRow)
  if (!mapped) return { ok: false, message: formatCatalogUserError(null) }
  return { ok: true, record: mapped }
}

export async function updateCarrier(
  supabase: SupabaseClient,
  input: { id: string; name?: string; isActive?: boolean },
): Promise<CatalogMutationResult<CatalogCarrier>> {
  const payload: { p_id: string; p_name?: string; p_is_active?: boolean } = { p_id: input.id }
  if (input.name !== undefined) payload.p_name = input.name.trim()
  if (input.isActive !== undefined) payload.p_is_active = input.isActive
  const { data, error } = await supabase.rpc(CATALOG_RPC.updateCarrier, payload)
  if (error) return mutationFailure(error)
  const mapped = mapCarrier(asRecord(data) as RawCarrierRow)
  if (!mapped) return { ok: false, message: formatCatalogUserError(null) }
  return { ok: true, record: mapped }
}

export async function createInsuranceProduct(
  supabase: SupabaseClient,
  input: { carrierId: string; name: string; productLine: ProductionProductLine },
): Promise<CatalogMutationResult<CatalogProduct>> {
  const { data, error } = await supabase.rpc(CATALOG_RPC.createProduct, {
    p_carrier_id: input.carrierId,
    p_name: input.name.trim(),
    p_product_line: input.productLine,
  })
  if (error) return mutationFailure(error)
  const mapped = mapProduct(asRecord(data) as RawProductRow)
  if (!mapped) return { ok: false, message: formatCatalogUserError(null) }
  return { ok: true, record: mapped }
}

export async function updateInsuranceProduct(
  supabase: SupabaseClient,
  input: { id: string; name?: string; isActive?: boolean },
): Promise<CatalogMutationResult<CatalogProduct>> {
  const payload: { p_id: string; p_name?: string; p_is_active?: boolean } = { p_id: input.id }
  if (input.name !== undefined) payload.p_name = input.name.trim()
  if (input.isActive !== undefined) payload.p_is_active = input.isActive
  const { data, error } = await supabase.rpc(CATALOG_RPC.updateProduct, payload)
  if (error) return mutationFailure(error)
  const mapped = mapProduct(asRecord(data) as RawProductRow)
  if (!mapped) return { ok: false, message: formatCatalogUserError(null) }
  return { ok: true, record: mapped }
}
