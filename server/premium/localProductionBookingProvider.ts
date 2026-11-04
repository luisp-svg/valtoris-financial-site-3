/** Offline preview provider for the actual TAC booking store. No remote credentials or HTTP. */
import { randomUUID } from 'node:crypto'
import type { PGlite } from '@electric-sql/pglite'
import type { TacBookingProvider } from './tacBookingService.js'
import { dateInZone } from './tacBookingService.js'
import type { TacBookingRecord } from './tacBookingStore.js'
export class LocalProductionBookingProvider implements TacBookingProvider{
 readonly locationId='localProductionQA'
 constructor(private readonly db:PGlite){}
 async initialize(){await this.db.exec(`CREATE TABLE IF NOT EXISTS local_production_booking_contacts(id text PRIMARY KEY,email text UNIQUE NOT NULL CHECK(email LIKE '%@example.invalid'));
 CREATE TABLE IF NOT EXISTS local_production_booking_events(id text PRIMARY KEY,request_id uuid UNIQUE NOT NULL REFERENCES tac_booking_requests(id),contact_id text NOT NULL REFERENCES local_production_booking_contacts(id),state text NOT NULL DEFAULT 'confirmed');`)}
 calendar(){return 'localProductionQA'}
 assertAllowed(_submission:string,email:string){if(!email.endsWith('@example.invalid'))throw new Error('booking_test_scope_required')}
 async assertSilent(){}
 async slots(_calendar:string,day:string,timezone:string){return Array.from({length:16},(_,i)=>new Date(Date.parse(day+'T14:00:00Z')+i*30*60000).toISOString()).filter(time=>Date.parse(time)>Date.now()&&dateInZone(time,timezone)===day)}
 async findContacts(b:TacBookingRecord){return (await this.db.query<{id:string}>('SELECT id FROM local_production_booking_contacts WHERE email=$1',[b.email])).rows.map(r=>r.id)}
 async verifyContact(b:TacBookingRecord,id:string){if(!(await this.db.query('SELECT 1 FROM local_production_booking_contacts WHERE id=$1 AND email=$2',[id,b.email])).rows.length)throw new Error('booking_identity_review_required')}
 async createContact(b:TacBookingRecord){this.assertAllowed(b.submission_id,b.email);const id=randomUUID().replace(/-/g,'');await this.db.query('INSERT INTO local_production_booking_contacts VALUES($1,$2)',[id,b.email]);return id}
 async findEvents(b:TacBookingRecord,contact:string){return (await this.db.query<{id:string}>('SELECT id FROM local_production_booking_events WHERE request_id=$1 AND contact_id=$2',[b.id,contact])).rows.map(r=>r.id)}
 async verifyEvent(b:TacBookingRecord,contact:string,id:string){const row=(await this.db.query<{state:'confirmed'|'cancelled'}>('SELECT state FROM local_production_booking_events WHERE id=$1 AND contact_id=$2 AND request_id=$3',[id,contact,b.id])).rows[0];if(!row)throw new Error('booking_event_verification_failed');return row.state}
 async createEvent(b:TacBookingRecord,contact:string){const id=randomUUID().replace(/-/g,'');await this.db.query('INSERT INTO local_production_booking_events(id,request_id,contact_id) VALUES($1,$2,$3)',[id,b.id,contact]);return id}
 async setStatus(submission:string,state:'confirmed'|'cancelled'){await this.db.query('UPDATE local_production_booking_events SET state=$2 WHERE request_id=(SELECT id FROM tac_booking_requests WHERE submission_id=$1)',[submission,state])}
}
