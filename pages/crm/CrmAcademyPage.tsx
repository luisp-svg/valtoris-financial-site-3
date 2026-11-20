import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

const COURSES = [
  { id: 'texas-pc', title: 'Texas General Lines P&C' },
  { id: 'student-loan', title: 'Student Loan Advisor Training' },
  { id: 'texas-life', title: 'Texas Life Insurance License Prep' },
  { id: 'texas-health', title: 'Texas Health Insurance License Prep' },
  { id: 'financial-planning-cfp-prep', title: 'Comprehensive Financial Planning · CFP® Prep' },
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
  const [selected, setSelected] = useState<(typeof COURSES)[number]['id']>('texas-pc')
  if (role !== 'owner' && role !== 'advisor') return <p>Academy access is available to TAC owners and advisors.</p>
  return <main>
    <h1>TAC Academy</h1>
    <nav aria-label="Academy courses">
      {COURSES.map(course => <button key={course.id} type="button" aria-pressed={selected === course.id}
        onClick={() => setSelected(course.id)}>{course.title}</button>)}
    </nav>
    <CourseView key={`${user?.id}:${selected}`} slug={selected} />
  </main>
}

async function courseRequest(slug: string, args = {}): Promise<Course> {
  const { data, error } = await createSupabaseBrowserClient().rpc('tac_academy_course', { p_course: slug, ...args })
  if (error || !data) throw new Error('Academy could not load or save your work. Please try again.')
  return data as Course
}

function CourseView({ slug }: { slug: string }) {
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
      setSelected(data.lastLesson ?? data.lessons[0]?.id)
    }).catch((err: Error) => { if (active) setError(err.message) })
    return () => { active = false }
  }, [slug, loadAttempt])

  async function save(args: object) {
    setBusy(true)
    setError('')
    try {
      setCourse(await courseRequest(slug, args))
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
