import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import { PILOT_LESSONS } from '../../crm/academy/pilotLessons'
import '../../crm/academy/pilot.css'

export default function CrmAcademyPilotPage() {
  const { status, profile, role } = useCrmAuth()
  if (status !== 'authenticated' || !profile?.is_active || (role !== 'owner' && role !== 'advisor')) {
    return <section className="crm-panel"><h1>Academy access unavailable</h1><p>This pilot is available to active Valtoris advisors and owners.</p><Link to={ROUTES.crm}>Back to TAC</Link></section>
  }
  return <AcademyLessonPlayer key={profile.id} />
}

function AcademyLessonPlayer() {
  const [step, setStep] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [result, setResult] = useState<'correct' | 'retry' | null>(null)
  const [completed, setCompleted] = useState<string[]>([])
  const lesson = PILOT_LESSONS[step]
  const allComplete = completed.length === PILOT_LESSONS.length

  function selectLesson(index: number) {
    setStep(index)
    setChoice(null)
    setResult(null)
  }

  function checkAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (choice === null) return
    if (choice !== lesson.answer) {
      setResult('retry')
      return
    }
    setCompleted(previous => previous.includes(lesson.id) ? previous : [...previous, lesson.id])
    setResult('correct')
  }

  return <div className="tac-academy-pilot">
    <header className="tac-academy-hero">
      <p className="tac-academy-kicker">Valtoris Academy · Advisor pilot</p>
      <h1>Student Loan Client Review</h1>
      <p>Practice the Valtoris workflow: clarify the goal, verify the record, and leave a clear next step.</p>
      <p className="tac-academy-preview-note">Local preview · Practice progress resets when you leave or refresh.</p>
    </header>
    <div className="tac-academy-layout">
      <nav className="crm-panel tac-academy-outline" aria-label="Course outline">
        <h2>Course outline</h2>
        <p>{completed.length} of {PILOT_LESSONS.length} practice checks complete</p>
        <progress aria-label="Practice checks completed" value={completed.length} max={PILOT_LESSONS.length} />
        <ol>{PILOT_LESSONS.map((item, index) => <li key={item.id}>
          <button type="button" aria-current={step === index ? 'step' : undefined} onClick={() => selectLesson(index)}>
            <span>{index + 1}. {item.title}</span>
            {completed.includes(item.id) && <small>Complete</small>}
          </button>
        </li>)}</ol>
      </nav>
      <article className="crm-panel tac-academy-lesson" aria-labelledby="academy-lesson-title">
        <p className="crm-page-eyebrow">Lesson {step + 1} of {PILOT_LESSONS.length}</p>
        <h2 id="academy-lesson-title">{lesson.title}</h2>
        <p>{lesson.goal}</p>
        <ol className="tac-academy-steps">{lesson.steps.map(item => <li key={item}>{item}</li>)}</ol>
        <section className="tac-academy-scenario" aria-label="Practice scenario"><strong>Practice scenario</strong><p>{lesson.scenario}</p></section>
        <form onSubmit={checkAnswer}>
          <fieldset>
            <legend>{lesson.question}</legend>
            {lesson.choices.map((option, index) => <label key={option} className="tac-academy-choice">
              <input type="radio" name="academy-choice" value={index} checked={choice === index} onChange={() => { setChoice(index); setResult(null) }} />
              <span>{option}</span>
            </label>)}
          </fieldset>
          <div className="tac-academy-actions">
            <button className="crm-primary-btn" type="submit" disabled={choice === null}>Check answer</button>
            {result === 'correct' && step < PILOT_LESSONS.length - 1 && <button className="crm-secondary-btn" type="button" onClick={() => selectLesson(step + 1)}>Next lesson</button>}
          </div>
          {result && <p role="status" className="tac-academy-feedback">{result === 'correct' ? `Correct. ${lesson.feedback}` : 'Try again. Revisit the workflow steps and choose the answer that makes the next action clear.'}</p>}
        </form>
        {allComplete && <p className="crm-banner crm-banner-success">All three practice checks are complete for this session.</p>}
      </article>
    </div>
    <aside className="crm-panel tac-academy-reference"><h2>External education</h2><p>This is original Valtoris workflow practice. It does not award a designation or continuing education credit.</p><a href="https://cslainstitute.org/home">Visit the CSLA Institute’s CSLP® program</a></aside>
  </div>
}
