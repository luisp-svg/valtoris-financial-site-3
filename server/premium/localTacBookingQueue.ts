import type { PGlite } from '@electric-sql/pglite'
import { assertQaBooking, type QaBooking, type TacBookingQueue, type ExportCheckpoint } from './silentTacBooking.js'

/** Durable localhost QA outbox. No production database connection or network I/O. */
export class LocalTacBookingQueue implements TacBookingQueue {
  constructor(private readonly db: PGlite) {}
  async initialize() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS local_agentcrm_test_contacts (
        contact_key uuid PRIMARY KEY,
        email text UNIQUE NOT NULL CHECK(email ~ '^[a-z0-9][a-z0-9._+-]*@example[.]invalid$'),
        started boolean NOT NULL DEFAULT false,
        external_id text UNIQUE
      );
      CREATE TABLE IF NOT EXISTS local_agentcrm_test_bookings (
        request_id uuid PRIMARY KEY,
        submission_id uuid UNIQUE NOT NULL REFERENCES local_submissions(id),
        contact_key uuid NOT NULL REFERENCES local_agentcrm_test_contacts(contact_key),
        calendar_id text NOT NULL,
        starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at > starts_at),
        started boolean NOT NULL DEFAULT false,
        external_id text UNIQUE,
        UNIQUE(contact_key,calendar_id,starts_at),
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `)
  }
  async save(input: QaBooking) {
    assertQaBooking(input)
    await this.db.transaction(async tx => {
      // A saved assessment and matching TAC test identity are prerequisites.
      const source = await tx.query<{ email: string; household_id: string }>(`SELECT c.email,c.household_id FROM local_submissions s
        JOIN local_contacts c ON c.id=s.contact_id WHERE s.id=$1`, [input.submissionId])
      if (source.rows[0]?.email !== input.email || source.rows[0]?.household_id !== input.contactKey) throw new Error('tac_assessment_identity_mismatch')
      await tx.query('INSERT INTO local_agentcrm_test_contacts(contact_key,email) VALUES($1,$2) ON CONFLICT(contact_key) DO NOTHING', [input.contactKey, input.email])
      const contact = await tx.query<{ email: string }>('SELECT email FROM local_agentcrm_test_contacts WHERE contact_key=$1', [input.contactKey])
      if (contact.rows[0]?.email !== input.email) throw new Error('tac_contact_identity_conflict')
      await tx.query(`INSERT INTO local_agentcrm_test_bookings(request_id,submission_id,contact_key,calendar_id,starts_at,ends_at)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(request_id) DO NOTHING`,
      [input.requestId, input.submissionId, input.contactKey, input.calendarId, input.startTime, input.endTime])
      const found = await tx.query<{ submission_id: string; contact_key: string; calendar_id: string; starts_at: string; ends_at: string }>(
        'SELECT * FROM local_agentcrm_test_bookings WHERE request_id=$1', [input.requestId])
      const row = found.rows[0]
      if (!row || row.submission_id !== input.submissionId || row.contact_key !== input.contactKey || row.calendar_id !== input.calendarId ||
        Date.parse(row.starts_at) !== Date.parse(input.startTime) || Date.parse(row.ends_at) !== Date.parse(input.endTime)) throw new Error('tac_booking_request_conflict')
    })
  }
  async load(requestId: string): Promise<QaBooking | null> {
    const result = await this.db.query<{ request_id: string; submission_id: string; contact_key: string; email: string; calendar_id: string; starts_at: string; ends_at: string }>(
      `SELECT b.*,c.email FROM local_agentcrm_test_bookings b JOIN local_agentcrm_test_contacts c USING(contact_key) WHERE request_id=$1`, [requestId])
    const row = result.rows[0]
    return row ? { requestId: row.request_id, submissionId: row.submission_id, contactKey: row.contact_key,
      email: row.email, calendarId: row.calendar_id, startTime: new Date(row.starts_at).toISOString(), endTime: new Date(row.ends_at).toISOString() } : null
  }
  private async checkpoint(table: 'contacts' | 'bookings', key: string): Promise<ExportCheckpoint> {
    const result = await this.db.query<{ started: boolean; external_id: string | null }>(
      `SELECT started,external_id FROM local_agentcrm_test_${table} WHERE ${table === 'contacts' ? 'contact_key' : 'request_id'}=$1`, [key])
    if (!result.rows[0]) throw new Error('tac_checkpoint_missing')
    return { started: result.rows[0].started, externalId: result.rows[0].external_id }
  }
  contactCheckpoint(key: string) { return this.checkpoint('contacts', key) }
  eventCheckpoint(key: string) { return this.checkpoint('bookings', key) }
  private async claim(table: 'contacts' | 'bookings', key: string) {
    const result = await this.db.query(`UPDATE local_agentcrm_test_${table} SET started=true
      WHERE ${table === 'contacts' ? 'contact_key' : 'request_id'}=$1 AND started=false AND external_id IS NULL RETURNING 1`, [key])
    return result.rows.length === 1
  }
  claimContact(key: string) { return this.claim('contacts', key) }
  claimEvent(key: string) { return this.claim('bookings', key) }
  private async link(table: 'contacts' | 'bookings', key: string, externalId: string) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(externalId)) throw new Error('invalid_external_id')
    const result = await this.db.query(`UPDATE local_agentcrm_test_${table} SET external_id=$2
      WHERE ${table === 'contacts' ? 'contact_key' : 'request_id'}=$1 AND (external_id IS NULL OR external_id=$2) RETURNING 1`, [key, externalId])
    if (result.rows.length !== 1) throw new Error('tac_external_link_conflict')
  }
  linkContact(key: string, id: string) { return this.link('contacts', key, id) }
  linkEvent(key: string, id: string) { return this.link('bookings', key, id) }
}
