import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import TextInput from '../components/assessment/TextInput'

export default function ScheduleReportCardPage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    preferredDate: '',
  })

  const isComplete = Object.values(form).every((value) => value.trim() !== '')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isComplete) return
    setSubmitted(true)
  }

  return (
    <div className="schedule-shell">
      <div className="schedule-container">
        <header className="schedule-header">
          <BrandLogo className="schedule-logo" />
        </header>

        {submitted ? (
          <section className="schedule-card schedule-success">
            <p className="schedule-kicker">Request Received</p>
            <h1>Your Report Card Review Is Scheduled</h1>
            <p>
              Thank you, {form.firstName}. A Valtoris advisor will follow up shortly to confirm your
              complimentary Family Financial Report Card™ review.
            </p>
            <Link className="schedule-primary-btn" to="/">
              Return Home
            </Link>
          </section>
        ) : (
          <section className="schedule-card">
            <p className="schedule-kicker">Book Your Review</p>
            <h1>Schedule My Report Card</h1>
            <p className="schedule-lead">
              Choose a time to review your Family Financial Report Card™ with a Valtoris advisor.
            </p>

            <form className="assessment-form" onSubmit={handleSubmit}>
              <TextInput
                label="First Name"
                name="scheduleFirstName"
                value={form.firstName}
                onChange={(value) => setForm((current) => ({ ...current, firstName: value }))}
                required
              />
              <TextInput
                label="Last Name"
                name="scheduleLastName"
                value={form.lastName}
                onChange={(value) => setForm((current) => ({ ...current, lastName: value }))}
                required
              />
              <TextInput
                label="Email"
                name="scheduleEmail"
                value={form.email}
                onChange={(value) => setForm((current) => ({ ...current, email: value }))}
                placeholder="you@email.com"
                required
              />
              <TextInput
                label="Phone"
                name="schedulePhone"
                value={form.phone}
                onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
                placeholder="(555) 555-5555"
                required
              />
              <TextInput
                label="Preferred Date"
                name="scheduleDate"
                value={form.preferredDate}
                onChange={(value) => setForm((current) => ({ ...current, preferredDate: value }))}
                placeholder="MM/DD/YYYY"
                required
              />
              <button type="submit" className="schedule-primary-btn" disabled={!isComplete}>
                Confirm Appointment
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  )
}
