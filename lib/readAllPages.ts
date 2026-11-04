/** Read bounded, stably ordered pages; never treat an error or repeated boundary as success. */
export async function readAllPages<T extends { id?: unknown }>(
  fetchPage: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  limit = Number.MAX_SAFE_INTEGER,
): Promise<T[]> {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid record limit.')
  const rows: T[] = [], seen = new Set<string>()
  while (rows.length < limit) {
    const size = Math.min(100, limit - rows.length)
    const { data, error } = await fetchPage(rows.length, rows.length + size - 1)
    if (error) throw error
    const batch = data ?? []
    for (const row of batch) {
      if (typeof row.id !== 'string' || seen.has(row.id)) throw new Error('Records changed while loading. Refresh to try again.')
      seen.add(row.id); rows.push(row)
    }
    if (batch.length < size) break
  }
  return rows
}

export async function readRowsForIds<T extends { id?: unknown }>(
  ids: readonly string[],
  fetchPage: (ids: string[], start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const unique = [...new Set(ids.filter(id => id.trim()))], result: T[] = []
  for (let offset = 0; offset < unique.length; offset += 100) {
    result.push(...await readAllPages<T>((start, end) => fetchPage(unique.slice(offset, offset + 100), start, end)))
  }
  return result
}
