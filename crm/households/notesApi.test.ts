import { describe, expect, it, vi } from 'vitest'
import {
  assertValidNoteBody,
  createHouseholdNote,
  formatSupabaseError,
  HouseholdNoteValidationError,
  normalizeNoteBody,
  resolveActorDisplayName,
  softDeleteHouseholdNote,
  updateHouseholdNote,
} from './notesApi'

describe('normalizeNoteBody / assertValidNoteBody', () => {
  it('trims note body', () => {
    expect(normalizeNoteBody('  hello  ')).toBe('hello')
  })

  it('rejects empty notes', () => {
    expect(() => assertValidNoteBody('')).toThrow('Note body is required.')
    expect(() => assertValidNoteBody('   ')).toThrow('Note body is required.')
  })

  it('returns trimmed body when valid', () => {
    expect(assertValidNoteBody('  keep me  ')).toBe('keep me')
  })
})

describe('resolveActorDisplayName', () => {
  it('returns null when no user id', () => {
    expect(resolveActorDisplayName({ userId: null, profileFullName: 'Ada' })).toBeNull()
  })

  it('prefers profile full name', () => {
    expect(
      resolveActorDisplayName({
        userId: 'u1',
        profileFullName: 'Ada Owner',
        advisorDisplayName: 'Ada Advisor',
      }),
    ).toBe('Ada Owner')
  })

  it('falls back to advisor display name then Advisor', () => {
    expect(
      resolveActorDisplayName({
        userId: 'u1',
        profileFullName: null,
        advisorDisplayName: 'Ada Advisor',
      }),
    ).toBe('Ada Advisor')
    expect(
      resolveActorDisplayName({
        userId: 'u1',
        profileFullName: '  ',
        advisorDisplayName: null,
      }),
    ).toBe('Advisor')
  })
})

describe('formatSupabaseError', () => {
  it('formats Postgrest-like errors', () => {
    expect(
      formatSupabaseError('create_note', {
        message: 'boom',
        code: '42501',
        details: 'denied',
        hint: 'check rls',
      }),
    ).toBe(
      'create_note failed | message=boom | code=42501 | details=denied | hint=check rls',
    )
  })

  it('surfaces validation errors directly', () => {
    expect(
      formatSupabaseError('create_note', new HouseholdNoteValidationError('Note body is required.')),
    ).toBe('Note body is required.')
  })
})

function mockNoteClient(options: {
  insertPayload?: Record<string, unknown>
  updatePayload?: Record<string, unknown>
}) {
  const noteRow = {
    id: '11111111-1111-1111-1111-111111111111',
    household_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    opportunity_id: null,
    author_user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    body: 'trimmed body',
    visibility: 'internal',
    created_at: '2026-07-01T10:00:00.000Z',
    updated_at: '2026-07-01T10:00:00.000Z',
    author: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', full_name: 'Ada' },
  }

  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: noteRow, error: null })),
    insert: vi.fn((payload: Record<string, unknown>) => {
      options.insertPayload = payload
      return chain
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      options.updatePayload = payload
      return chain
    }),
  }

  return {
    from: vi.fn((table: string) => {
      if (table === 'advisor_profiles') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              is: vi.fn(() => ({
                eq: vi.fn(async () => ({ data: [], error: null })),
              })),
            })),
          })),
        }
      }
      return chain
    }),
  }
}

describe('createHouseholdNote / updateHouseholdNote payloads', () => {
  it('trims create payload and rejects empty notes before insert', async () => {
    const options: { insertPayload?: Record<string, unknown> } = {}
    const supabase = mockNoteClient(options) as never

    await expect(
      createHouseholdNote(
        supabase,
        { household_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', body: '   ' },
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      ),
    ).rejects.toBeInstanceOf(HouseholdNoteValidationError)
    expect(options.insertPayload).toBeUndefined()

    await createHouseholdNote(
      supabase,
      {
        household_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        body: '  keep me  ',
      },
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    )
    expect(options.insertPayload).toMatchObject({
      household_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      author_user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      body: 'keep me',
      visibility: 'internal',
    })
  })

  it('trims update payload', async () => {
    const options: { updatePayload?: Record<string, unknown> } = {}
    const supabase = mockNoteClient(options) as never
    await updateHouseholdNote(supabase, '11111111-1111-1111-1111-111111111111', '  updated  ')
    expect(options.updatePayload).toEqual({ body: 'updated' })
  })
})

describe('softDeleteHouseholdNote', () => {
  it('calls soft_delete_note RPC with note id only', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: '11111111-1111-1111-1111-111111111111',
      error: null,
    })
    const supabase = { rpc } as never

    const deletedId = await softDeleteHouseholdNote(
      supabase,
      '11111111-1111-1111-1111-111111111111',
    )

    expect(deletedId).toBe('11111111-1111-1111-1111-111111111111')
    expect(rpc).toHaveBeenCalledWith('soft_delete_note', {
      p_note_id: '11111111-1111-1111-1111-111111111111',
    })
  })

  it('throws when RPC returns an error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'cannot soft-delete note', code: 'P0001' },
    })
    const supabase = { rpc } as never

    await expect(
      softDeleteHouseholdNote(supabase, '11111111-1111-1111-1111-111111111111'),
    ).rejects.toMatchObject({ message: 'cannot soft-delete note' })
  })
})
