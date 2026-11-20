import './academyHome.css'
import { useCallback, useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

const COURSES = [
  { id: 'texas-pc', title: 'Texas General Lines P&C', description: 'Prepare for the Texas property and casualty exam with practice on policies, coverage and claims.' },
  { id: 'student-loan', title: 'Student Loan Advisor Training', description: 'Help borrowers compare repayment options, review forgiveness eligibility and plan their next steps.' },
  { id: 'texas-life', title: 'Texas Life Insurance License Prep', description: 'Study life insurance policies, annuities and Texas licensing rules through practice questions.' },
  { id: 'texas-health', title: 'Texas Health Insurance License Prep', description: 'Review health insurance coverage, policy provisions and Texas exam topics.' },
  { id: 'financial-planning-cfp-prep', title: 'Comprehensive Financial Planning · CFP® Prep', description: 'Practice connecting cash flow, investments, taxes and risk in a comprehensive financial plan.' },
  { id: 'ricp-prep', title: 'Retirement Income Planning · RICP® Prep', description: 'Build retirement income strategies around spending needs, longevity and reliable income.' },
  { id: 'clu-prep', title: 'Life Insurance and Business Planning · CLU® Prep', description: 'Explore how life insurance supports families, business succession and estate planning.' },
  { id: 'cic-prep', title: 'Insurance Coverage and Agency Practice · CIC Prep', description: 'Practice identifying coverage gaps and applying policy terms in everyday agency work.' },
  { id: 'health-underwriting-rhu-legacy', title: 'Health Underwriting and Benefits · Legacy RHU Study', description: 'Study health underwriting, group coverage and the design of employee benefits.' },
  { id: 'cebs-us-prep', title: 'Employee Benefits and Retirement Plans · U.S. CEBS Prep', description: 'Explore how employers design and administer health benefits and retirement plans.' },
] as const

type Lesson = { id: string; title: string; html: string }
type Course = {
  title: string
  lessons: Lesson[]
  questions: { prompt: string; choices: string[] }[]
  lastLesson: string | null
  completed: string[]
  lastCorrect: number | null
  bestCorrect: number | null
  attempts: number
}

export default function CrmAcademyPage() {
  const { role, user } = useCrmAuth()
  if (role !== 'owner' && role !== 'advisor') return <p>Academy access is available to TAC owners and advisors.</p>
  return <AcademyHome key={user?.id} />
}

type CourseId = (typeof COURSES)[number]['id']
type Progress = { complete: number; total: number; started: boolean }

function summarize(course: Course): Progress {
  const completed = new Set(course.completed)
  return {
    complete: course.lessons.filter(lesson => completed.has(lesson.id)).length,
    total: course.lessons.length,
    started: Boolean(course.lastLesson || course.attempts || completed.size),
  }
}

function AcademyHome() {
  const [selected, setSelected] = useState<CourseId | null>(null)
  const [progress, setProgress] = useState<Partial<Record<CourseId, Progress | null>>>({})
  const remember = useCallback((id: CourseId, course: Course) => {
    setProgress(previous => ({ ...previous, [id]: summarize(course) }))
  }, [])

  useEffect(() => {
    let active = true
    for (const { id } of COURSES) {
      courseRequest(id).then(course => {
        if (active) setProgress(previous => id in previous ? previous : { ...previous, [id]: summarize(course) })
      }).catch(() => {
        if (active) setProgress(previous => id in previous ? previous : { ...previous, [id]: null })
      })
    }
    return () => { active = false }
  }, [])

  if (selected) return <main className="academy-home">
    <button type="button" className="academy-back" onClick={() => setSelected(null)}>← All courses</button>
    <CourseView key={selected} slug={selected} onProgress={remember} />
  </main>

  return <main className="academy-home">
    <header className="academy-welcome">
      <h1>Welcome to TAC Academy</h1>
      <p>Choose a course to build your skills, prepare for an exam, or pick up where you left off.</p>
    </header>
    <section aria-label="Course catalog" className="academy-catalog">
      {COURSES.map(course => {
        const saved = progress[course.id]
        const percent = saved && saved.total ? Math.round(100 * saved.complete / saved.total) : 0
        const finished = saved && saved.total > 0 && saved.complete === saved.total
        const action = finished ? 'Review course' : saved?.started ? 'Resume course' : saved ? 'Start course' : 'Open course'
        return <article key={course.id} className="academy-card">
          <h2>{course.title}</h2>
          <p>{course.description}</p>
          <div className="academy-card-progress">
            <div><span>{saved ? `${saved.complete} of ${saved.total} items complete` : saved === null ? 'Progress unavailable' : 'Loading progress…'}</span>
              {saved && <strong>{percent}%</strong>}</div>
            {saved && <progress aria-label={`${course.title} completion`} value={saved.complete} max={saved.total || 1} />}
          </div>
          <button type="button" className="academy-open" aria-label={`${action}: ${course.title}`} onClick={() => setSelected(course.id)}>{action} <span aria-hidden="true">→</span></button>
        </article>
      })}
    </section>
  </main>
}

async function courseRequest(slug: string, args = {}): Promise<Course> {
  const { data, error } = await createSupabaseBrowserClient().rpc('tac_academy_course', { p_course: slug, ...args })
  if (error || !data) throw new Error('Academy could not load or save your work. Please try again.')
  return data as Course
}

function CourseView({ slug, onProgress }: { slug: CourseId; onProgress: (slug: CourseId, course: Course) => void }) {
  const [course, setCourse] = useState<Course>()
  const [selected, setSelected] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let active = true
    courseRequest(slug).then(data => {
      if (!active) return
      setCourse(data)
      onProgress(slug, data)
      setSelected(data.lastLesson ?? data.lessons[0]?.id)
    }).catch((err: Error) => { if (active) setError(err.message) })
    return () => { active = false }
  }, [slug, loadAttempt, onProgress])

  async function save(args: object) {
    setBusy(true)
    setError('')
    try {
      const updated = await courseRequest(slug, args)
      setCourse(updated)
      onProgress(slug, updated)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function openLesson(id: string) {
    setSelected(id)
    void save({ p_lesson: id })
  }

  function followLessonLink(event: MouseEvent<HTMLElement>) {
    const target = event.target
    const href = target instanceof Element ? target.closest('a')?.getAttribute('href') : null
    if (!href?.startsWith('#')) return
    const id = href.slice(1)
    if ((id === 'final' && slug === 'texas-pc') || course?.lessons.some(lesson => lesson.id === id)) {
      event.preventDefault()
      if (busy) return
      if (id === 'final') setSelected('exam')
      else openLesson(id)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    void save({ p_answers: course?.questions.map((_, index) => values.get(String(index))) })
  }

  if (!course) return error
    ? <p role="alert">{error} <button type="button" onClick={() => { setError(''); setLoadAttempt(attempt => attempt + 1) }}>Retry</button></p>
    : <p role="status">Loading course…</p>

  const lesson = course.lessons.find(item => item.id === selected)
  const index = course.lessons.findIndex(item => item.id === selected)
  const next = course.lessons[index + 1]
  const examTitle = slug === 'student-loan' ? 'Comprehensive final exam' : 'Graded knowledge review'
  const examInstructions = slug === 'student-loan'
    ? 'The internal study target is 80 out of 100.'
    : `This ${course.questions.length}-question review checks course knowledge. Use a separate timed mock for exam pacing.`
  return <section>
    <h2>{course.title}</h2>
    <p role="status">{course.completed.length} of {course.lessons.length} course items complete.
      {course.attempts > 0 && ` Latest score ${course.lastCorrect}/${course.questions.length}. Best score ${course.bestCorrect}/${course.questions.length}. Attempts ${course.attempts}.`}
    </p>
    {error && <p role="alert">{error}</p>}
    <label>Open a lesson or exam <select value={selected} disabled={busy} onChange={event => {
      const id = event.target.value
      if (id === 'exam') setSelected(id)
      else openLesson(id)
    }}>
      {course.lessons.map(item => <option key={item.id} value={item.id}>
        {course.completed.includes(item.id) ? '✓ ' : ''}{item.title}
      </option>)}
      <option value="exam">{examTitle}</option>
    </select></label>
    {lesson && <>
      {/* The RPC serves only reviewed course content seeded from the Academy assets. */}
      <article onClick={followLessonLink} dangerouslySetInnerHTML={{ __html: lesson.html }} />
      <button type="button" disabled={busy || course.completed.includes(lesson.id)}
        onClick={() => void save({ p_lesson: lesson.id, p_complete: true })}>Mark complete</button>
      {next && <button type="button" disabled={busy} onClick={() => openLesson(next.id)}>Next item</button>}
    </>}
    {selected === 'exam' && <form onSubmit={submit}>
      <h3>{examTitle}</h3>
      <p>{examInstructions}</p>
      {course.questions.map((question, index) => <fieldset key={index} disabled={busy}>
        <legend>{index + 1}. {question.prompt.replace(/^\d+\.\s*/, '')}</legend>
        {question.choices.map((choice, choiceIndex) => <label key={choiceIndex} style={{ display: 'block' }}>
          <input type="radio" required name={String(index)} value={'ABCD'[choiceIndex]} /> {choice}
        </label>)}
      </fieldset>)}
      <button type="submit" disabled={busy}>Submit for grading</button>
    </form>}
  </section>
}
