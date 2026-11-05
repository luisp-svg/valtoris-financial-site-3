import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import { CORE_LESSONS } from '../../crm/academy/coreLessons'
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
  const [course, setCourse] = useState<'core' | 'student-loans'>('core')
  const [step, setStep] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [result, setResult] = useState<'correct' | 'retry' | null>(null)
  const [completed, setCompleted] = useState<string[]>([])
  const isCore = course === 'core'
  const lessons = isCore ? CORE_LESSONS : PILOT_LESSONS
  const lesson = lessons[step]
  const courseCompleted = lessons.filter(item => completed.includes(item.id)).length
  const coreComplete = CORE_LESSONS.every(item => completed.includes(item.id))
  const allComplete = courseCompleted === lessons.length

  function selectCourse(next: 'core' | 'student-loans') {
    setCourse(next)
    selectLesson(0)
  }

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
      <h1>{isCore ? 'Valtoris Core' : 'Student Loan Client Review'}</h1>
      <p>{isCore ? 'Shared training for every Valtoris agent before specialty coursework.' : 'Practice the Valtoris workflow for a student loan review.'}</p>
      <p className="tac-academy-preview-note">Local preview · Practice progress resets when you leave or refresh.</p>
    </header>
    <section className="crm-panel" aria-label="Learning path">
      <h2>Learning path</h2>
      <div className="tac-academy-actions">
        <button type="button" className="crm-secondary-btn" aria-pressed={isCore} onClick={() => selectCourse('core')}>Valtoris Core</button>
        <button type="button" className="crm-secondary-btn" aria-pressed={!isCore} disabled={!coreComplete} onClick={() => selectCourse('student-loans')}>Student Loan Client Review</button>
      </div>
      {!coreComplete && <p>Complete the four Core practice checks to open the student loan specialty.</p>}
    </section>
    <div className="tac-academy-layout">
      <nav className="crm-panel tac-academy-outline" aria-label="Course outline">
        <h2>Course outline</h2>
        <p>{courseCompleted} of {lessons.length} practice checks complete</p>
        <progress aria-label="Practice checks completed" value={courseCompleted} max={lessons.length} />
        <ol>{lessons.map((item, index) => <li key={item.id}>
          <button type="button" aria-current={step === index ? 'step' : undefined} onClick={() => selectLesson(index)}>
            <span>{index + 1}. {item.title}</span>
            {completed.includes(item.id) && <small>Complete</small>}
          </button>
        </li>)}</ol>
      </nav>
      <article className="crm-panel tac-academy-lesson" aria-labelledby="academy-lesson-title">
        <p className="crm-page-eyebrow">Lesson {step + 1} of {lessons.length}</p>
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
            {result === 'correct' && step < lessons.length - 1 && <button className="crm-secondary-btn" type="button" onClick={() => selectLesson(step + 1)}>Next lesson</button>}
          </div>
          {result && <p role="status" className="tac-academy-feedback">{result === 'correct' ? `Correct. ${lesson.feedback}` : 'Try again. Revisit the workflow steps and choose the answer that makes the next action clear.'}</p>}
        </form>
        {allComplete && <p className="crm-banner crm-banner-success">{isCore ? 'Core practice complete. The student loan specialty is now available.' : 'Student loan practice complete for this session.'}</p>}
      </article>
    </div>
    <aside className="crm-panel tac-academy-reference"><h2>External education</h2><p>This is original Valtoris workflow practice. It does not award a designation or continuing education credit.</p><a href="https://cslainstitute.org/home">Visit the CSLA Institute’s CSLP® program</a></aside>
  </div>
}
