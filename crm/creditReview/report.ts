export type Tradeline = {
  accountGroup: number
  creditor: string
  originalCreditor: string
  bureau: string
  balance: number | null
  reported: string
  opened: string
  status: string
}

export function parseIdentityIq(html: string): Tradeline[] {
  // Template content is inert and is never inserted into the live document.
  const template = document.createElement('template')
  template.innerHTML = html
  const lines: Tradeline[] = []
  for (const [accountGroup, table] of Array.from(template.content.querySelectorAll('table.rpt_table4column')).entries()) {
    const rows = Array.from(table.rows)
    const headers = rows.find(row => Array.from(row.cells).some(cell => cell.textContent?.trim() === 'TransUnion'))
    if (!headers) continue
    const fields = new Map(rows.map(row => [row.cells[0]?.textContent?.trim(), Array.from(row.cells)]))
    if (!fields.has('Account #:') || !fields.has('Payment Status:')) continue

    const heading = table.previousElementSibling?.textContent?.trim().replace(/\s+/g, ' ') ?? ''
    if (!heading || heading.includes('{{')) continue
    const [creditor, originalCreditor = ''] = heading.split(/\s*\(Original Creditor:\s*/i)
    for (const [i, bureau] of ['TransUnion', 'Experian', 'Equifax'].entries()) {
      const field = (label: string) => fields.get(label)?.[i + 1]?.textContent?.trim() ?? ''
      if (!field('Account #:') || /^-|\{\{/.test(field('Account #:'))) continue
      const rawBalance = field('Balance:')
      const balance = /^\$[\d,.]+$/.test(rawBalance) ? Number(rawBalance.replace(/[$,]/g, '')) : null
      lines.push({
        accountGroup,
        creditor,
        originalCreditor: originalCreditor.replace(/^\d{2}\s+|\)$/g, ''),
        bureau,
        balance,
        reported: field('Last Reported:'),
        opened: field('Date Opened:'),
        status: [field('Account Status:'), field('Payment Status:'), field('Account Type - Detail:')].join(' · '),
      })
    }
  }
  return lines
}

export function reviewTradelines(lines: Tradeline[]) {
  return lines.map(line => {
    const matched = lines.filter(other => other !== line &&
      other.creditor === line.creditor && other.originalCreditor === line.originalCreditor)
    const comparable = matched.filter(other => other.bureau !== line.bureau && other.accountGroup === line.accountGroup)
    const balanceMismatch = line.balance !== null && comparable.some(other =>
      other.balance !== null && other.balance !== line.balance)
    const collection = /collection/i.test(line.status) && !/auto loan/i.test(line.status)
    const chargeOff = /charge.?off/i.test(line.status)
    const late = /late|past due/i.test(line.status)
    const possibleDuplicate = collection && Boolean(line.originalCreditor) &&
      matched.some(other => other.bureau === line.bureau && /collection/i.test(other.status))
    const checks: string[] = []
    if (balanceMismatch) checks.push('Balances differ across bureaus for this account. Confirm the account match and compare statements at each reporting date.')
    if (possibleDuplicate) checks.push('Multiple collections name this original creditor on this bureau. Match each entry to its own invoice before disputing a duplicate.')
    if (collection || chargeOff) checks.push('Verify the itemized balance and original delinquency date. The collection opening date cannot establish when reporting should end.')
    if (chargeOff && /auto/i.test(line.status)) checks.push('If the vehicle was repossessed, check the sale notice, proceeds, and deficiency ledger for missing credits or incorrect fees.')
    if (late) checks.push('Check the specific late months against the payment ledger and any extensions. If accurate, consider a goodwill request.')
    return { ...line, checks }
  })
}
