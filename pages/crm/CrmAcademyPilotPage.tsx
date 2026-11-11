import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import { CORE_LESSONS } from '../../crm/academy/coreLessons'
import { PILOT_LESSONS } from '../../crm/academy/pilotLessons'
import { fetchAcademyProgress, type AcademyProgress } from '../../crm/academy/progressApi'
import AcademyExam from '../../crm/academy/AcademyExam'
import AcademyOwnerOverview from '../../crm/academy/AcademyOwnerOverview'
import '../../crm/academy/pilot.css'

export default function CrmAcademyPilotPage() {
  const { status, profile, role } = useCrmAuth()
  if (status !== 'authenticated' || !profile?.is_active || (role !== 'owner' && role !== 'advisor')) {
    return <section className="crm-panel"><h1>Academy access unavailable</h1><p>This pilot is available to active Valtoris advisors and owners.</p><Link to={ROUTES.crm}>Back to TAC</Link></section>
  }
  return <AcademyWorkspace key={profile.id} owner={role === 'owner'} />
}

function AcademyWorkspace({ owner }: { owner: boolean }) {
  const [showOverview, setShowOverview] = useState(false)

  return <div className="tac-academy-pilot">
    {owner && <nav className="tac-academy-actions" aria-label="Academy views">
      <button type="button" className="crm-secondary-btn" aria-pressed={!showOverview} onClick={() => setShowOverview(false)}>My learning</button>
      <button type="button" className="crm-secondary-btn" aria-pressed={showOverview} onClick={() => setShowOverview(true)}>Advisor progress</button>
    </nav>}
    {owner && showOverview ? <AcademyOwnerOverview /> : <AcademyLessonPlayer />}
  </div>
}

function AcademyLessonPlayer() {
  const [exam, setExam] = useState<'core' | 'student-loan' | null>(null)
  const [progress, setProgress] = useState<AcademyProgress | null>(null)
  const [choice, setChoice] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const saving = useRef(false)

  useEffect(() => {
    let active = true
    fetchAcademyProgress().then(
      data => { if (active) setProgress(data) },
      () => { if (active) setError('Could not load your saved progress.') },
    )
    return () => { active = false }
  }, [attempt])

  if (!progress) {
    return <section className="crm-panel">
      <h1>Valtoris Academy</h1>
      {error ? <>
        <p role="alert">{error}</p>
        <button type="button" className="crm-secondary-btn" onClick={() => { setError(''); setAttempt(n => n + 1) }}>Retry</button>
      </> : <p role="status">Loading your saved progress…</p>}
    </section>
  }

  const completed = progress.completed
  const coreComplete = CORE_LESSONS.every(item => completed.includes(item.id))
  const specialtyComplete = coreComplete && PILOT_LESSONS.every(item => completed.includes(item.id))
  const isCore = !coreComplete || !PILOT_LESSONS.some(item => item.id === progress.lastLesson)
  const lessons = isCore ? CORE_LESSONS : PILOT_LESSONS
  const step = Math.max(0, lessons.findIndex(item => item.id === progress.lastLesson))
  const lesson = lessons[step]
  const courseCompleted = lessons.filter(item => completed.includes(item.id)).length
  const allComplete = courseCompleted === lessons.length
  const result = progress.correct === null ? null : progress.correct ? 'correct' : 'retry'

  async function save(lessonId: string, answer?: number) {
    if (saving.current) return
    saving.current = true
    setBusy(true)
    setError('')
    try {
      setProgress(await fetchAcademyProgress(lessonId, answer))
      if (answer === undefined) setChoice(null)
    } catch {
      setError('Could not save your progress. Try again.')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  function selectLesson(index: number) {
    void save(lessons[index].id)
  }

  function checkAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (choice !== null) void save(lesson.id, choice)
  }

  if ((exam === 'core' && coreComplete) || (exam === 'student-loan' && specialtyComplete)) {
    return <AcademyExam key={exam} kind={exam} onBack={() => setExam(null)} />
  }

  return <div className="tac-academy-pilot">
    <header className="tac-academy-hero">
      <p className="tac-academy-kicker">Valtoris Academy · Advisor pilot</p>
      <h1>{isCore ? 'Valtoris Core' : 'Student Loan Client Review'}</h1>
      <p>{isCore ? 'Shared training for every Valtoris agent before specialty coursework.' : 'Practice the Valtoris workflow for a student loan review.'}</p>
      <p className="tac-academy-preview-note">Development pilot · Progress is saved to your TAC account.</p>
    </header>
    <section className="crm-panel" aria-label="Learning path">
      <h2>Learning path</h2>
      <div className="tac-academy-actions">
        <button type="button" className="crm-secondary-btn" aria-pressed={isCore} disabled={busy} onClick={() => void save(CORE_LESSONS[0].id)}>Valtoris Core</button>
        <button type="button" className="crm-secondary-btn" aria-pressed={!isCore} disabled={busy || !coreComplete} onClick={() => void save(PILOT_LESSONS[0].id)}>Student Loan Client Review</button>
        <button type="button" className="crm-secondary-btn" disabled={busy || !coreComplete} onClick={() => setExam('core')}>Core exam</button>
        <button type="button" className="crm-secondary-btn" disabled={busy || !specialtyComplete} onClick={() => setExam('student-loan')}>Student loan exam</button>
      </div>
      {!coreComplete && <p>Complete the four Core practice checks to open the student loan specialty.</p>}
    </section>
    {error && <p className="crm-banner crm-banner-error" role="alert">{error}</p>}
    <div className="tac-academy-layout" aria-busy={busy}>
      <nav className="crm-panel tac-academy-outline" aria-label="Course outline">
        <h2>Course outline</h2>
        <p>{courseCompleted} of {lessons.length} practice checks complete</p>
        <progress aria-label="Practice checks completed" value={courseCompleted} max={lessons.length} />
        <ol>{lessons.map((item, index) => <li key={item.id}>
          <button type="button" aria-current={step === index ? 'step' : undefined} disabled={busy} onClick={() => selectLesson(index)}>
            <span>{index + 1}. {item.title}</span>
            {completed.includes(item.id) && <small>Complete</small>}
          </button>
        </li>)}</ol>
      </nav>
      <article className="crm-panel tac-academy-lesson" aria-labelledby="academy-lesson-title">
        <p className="crm-page-eyebrow">Lesson {step + 1} of {lessons.length}</p>
        <h2 id="academy-lesson-title">{lesson.title}</h2>
        <p>{lesson.goal}</p>
        {'material' in lesson && <div className="tac-academy-material">
          <section aria-labelledby="academy-objectives">
            <h3 id="academy-objectives">What you’ll learn</h3>
            <p>Estimated time {lesson.material.duration}</p>
            <ul>{lesson.material.objectives.map(objective => <li key={objective}>{objective}</li>)}</ul>
          </section>
          {lesson.material.sections.map(section => <section key={section.title}>
            <h3>{section.title}</h3>
            {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </section>)}
          <section className="tac-academy-scenario">
            <h3>Worked example</h3>
            <p>{lesson.material.example.situation}</p>
            <p><strong>What to say</strong> {lesson.material.example.response}</p>
            <p><strong>What to record</strong> {lesson.material.example.record}</p>
          </section>
          <section>
            <h3>Practice in TAC</h3>
            <p>{lesson.material.exercise.prompt}</p>
            <p>{lesson.material.exercise.instruction}</p>
            <h4>Check your work</h4>
            <ul>{lesson.material.exercise.checklist.map(item => <li key={item}>{item}</li>)}</ul>
          </section>
          {'sources' in lesson.material && <section>
            <h3>Lesson references</h3>
            <p>Sources checked {lesson.material.sourceReviewDate}</p>
            <ul>{lesson.material.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul>
          </section>}
          <h3>Workflow recap</h3>
        </div>}
        <ol className="tac-academy-steps">{lesson.steps.map(item => <li key={item}>{item}</li>)}</ol>
        <section className="tac-academy-scenario" aria-label="Practice scenario"><strong>Practice scenario</strong><p>{lesson.scenario}</p></section>
        <form onSubmit={checkAnswer}>
          <fieldset disabled={busy}>
            <legend>{lesson.question}</legend>
            {lesson.choices.map((option, index) => <label key={option} className="tac-academy-choice">
              <input type="radio" name="academy-choice" value={index} checked={choice === index} onChange={() => { setChoice(index); setProgress({ ...progress, correct: null }) }} />
              <span>{option}</span>
            </label>)}
          </fieldset>
          <div className="tac-academy-actions">
            <button className="crm-primary-btn" type="submit" disabled={busy || choice === null}>Check answer</button>
            {result === 'correct' && step < lessons.length - 1 && <button className="crm-secondary-btn" type="button" disabled={busy} onClick={() => selectLesson(step + 1)}>Next lesson</button>}
          </div>
          {result && <p role="status" className="tac-academy-feedback">{result === 'correct' ? `Correct. ${lesson.feedback}` : 'Try again. Revisit the workflow steps and choose the answer that makes the next action clear.'}</p>}
        </form>
        {allComplete && <p className="crm-banner crm-banner-success">{isCore ? 'Core practice complete. The student loan specialty is now available.' : 'Student loan practice complete. The student loan exam is now available.'}</p>}
      </article>
    </div>
  </div>
}
