import { describe, expect, it, vi } from 'vitest'
import {
  APPROVED_CATALOG_RPCS,
  createCarrier,
  createInsuranceProduct,
  fetchCatalogCarriers,
  updateCarrier,
  updateInsuranceProduct,
} from './catalogApi'

function rpcClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as never
}

describe('catalog API RPC mapping', () => {
  it('maps create_carrier arguments', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: 'c1',
        code: 'ACME',
        name: 'Acme',
        is_active: true,
        created_at: 't',
        updated_at: 't',
      },
      error: null,
    })
    const result = await createCarrier(rpcClient(rpc), { code: ' ACME ', name: ' Acme ' })
    expect(rpc).toHaveBeenCalledWith('create_carrier', { p_code: 'ACME', p_name: 'Acme' })
    expect(result).toMatchObject({ ok: true, record: { id: 'c1', code: 'ACME' } })
  })

  it('maps update_carrier rename and activation separately', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { id: 'c1', code: 'ACME', name: 'Renamed', is_active: false, created_at: 't', updated_at: 't' },
      error: null,
    })
    await updateCarrier(rpcClient(rpc), { id: 'c1', name: 'Renamed' })
    expect(rpc).toHaveBeenCalledWith('update_carrier', { p_id: 'c1', p_name: 'Renamed' })
    await updateCarrier(rpcClient(rpc), { id: 'c1', isActive: false })
    expect(rpc).toHaveBeenCalledWith('update_carrier', { p_id: 'c1', p_is_active: false })
  })

  it('maps create_insurance_product and update_insurance_product arguments', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: 'p1',
        carrier_id: 'c1',
        name: 'Term 20',
        product_line: 'life_term',
        is_active: true,
        created_at: 't',
        updated_at: 't',
      },
      error: null,
    })
    await createInsuranceProduct(rpcClient(rpc), {
      carrierId: 'c1',
      name: 'Term 20',
      productLine: 'life_term',
    })
    expect(rpc).toHaveBeenCalledWith('create_insurance_product', {
      p_carrier_id: 'c1',
      p_name: 'Term 20',
      p_product_line: 'life_term',
    })
    await updateInsuranceProduct(rpcClient(rpc), { id: 'p1', isActive: true })
    expect(rpc).toHaveBeenCalledWith('update_insurance_product', { p_id: 'p1', p_is_active: true })
  })

  it('returns safe user errors for CRM_PP failures', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'CRM_PP:not_authorized' },
    })
    const result = await createCarrier(rpcClient(rpc), { code: 'X', name: 'Y' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/permission/i)
      expect(result.message).not.toMatch(/CRM_PP|42501/i)
    }
  })

  it('loads carriers with SELECT only', async () => {
    const eq = vi.fn()
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ id: 'c1', code: 'A', name: 'Ace', is_active: true, created_at: 't', updated_at: 't' }],
              error: null,
            }),
          }),
        }),
      }),
      rpc: eq,
    }
    const rows = await fetchCatalogCarriers(client as never)
    expect(client.from).toHaveBeenCalledWith('carriers')
    expect(eq).not.toHaveBeenCalled()
    expect(rows[0].code).toBe('A')
  })

  it('only exposes the four approved catalog RPCs', () => {
    expect([...APPROVED_CATALOG_RPCS]).toEqual([
      'create_carrier',
      'update_carrier',
      'create_insurance_product',
      'update_insurance_product',
    ])
  })
})
