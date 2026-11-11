import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import AcademyCoreCertificate, { type CoreCertificate } from './AcademyCoreCertificate'
import { STUDENT_LOAN_EXAM_CASE, STUDENT_LOAN_EXAM_QUESTIONS } from './studentLoanExamQuestions'
import { CORE_EXAM_QUESTIONS } from './coreExamQuestions'
import { CORE_EXAM_PASS, formatCoreExamScore } from './coreExamScore'

type Result = { score: number | null; best: number | null; certificate: CoreCertificate | null }

type ExamKind = 'core' | 'student-loan'

async function fetchResult(kind: ExamKind, answers?: number[]): Promise<Result> {
  const { data, error } = await createSupabaseBrowserClient().rpc(kind === 'core' ? 'academy_pilot_core_exam' : 'academy_pilot_student_loan_exam', { p_answers: answers ?? null })
  if (error || !data) throw new Error('Exam result unavailable')
  return data
}

export default function AcademyExam({ kind, onBack }: { kind: ExamKind; onBack: () => void }) {
  const isCore = kind === 'core'
  const questions = isCore ? CORE_EXAM_QUESTIONS : STUDENT_LOAN_EXAM_QUESTIONS
  const [answers, setAnswers] = useState<number[]>(() => questions.map(() => -1))
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const submitting = useRef(false)

  useEffect(() => {
    let active = true
    fetchResult(kind).then(data => { if (active) setResult(data) }, () => {
      if (active) setError('Could not load your previous exam score. You can still submit an attempt.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [kind])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading || submitting.current || answers.includes(-1)) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      setResult(await fetchResult(kind, answers))
    } catch {
      setError('Could not grade the exam. Try submitting again.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <section className="crm-panel tac-academy-lesson">
    <h1>{isCore ? 'Valtoris Core exam' : 'Student Loan Client Review exam'}</h1>
    <p>Answer all seven questions. Six correct answers meet the 85% passing mark. You can retry and your best score is saved.</p>
    {result?.best != null && <p>Best score: {formatCoreExamScore(result.best)} · {result.best >= CORE_EXAM_PASS ? 'Passed' : 'Below passing mark'}</p>}
    {result?.score != null && <p role="status">This attempt: {formatCoreExamScore(result.score)}</p>}
    {!isCore && result?.score != null && <details className="tac-academy-material">
      <summary>Review the TAC exercise</summary>
      <p>Compare your notes and tasks with this sample. Each section names the lesson you can revisit.</p>
      {STUDENT_LOAN_EXAM_CASE.debrief.map(({ lesson, title, text }) => <section key={lesson}>
        <h2>{title}</h2>
        <p><strong>Lesson</strong> {lesson}</p>
        <p>{text}</p>
      </section>)}
      <h2>Sample client update</h2>
      <p>{STUDENT_LOAN_EXAM_CASE.clientUpdate}</p>
    </details>}
    {error && <p role="alert">{error}</p>}
    {result?.certificate && <AcademyCoreCertificate certificate={result.certificate} course={isCore ? 'Valtoris Core' : 'Student Loan Client Review'} />}
    {!isCore && <div className="tac-academy-material">
      <section>
        <h2>Client case</h2>
        {STUDENT_LOAN_EXAM_CASE.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      </section>
      <section>
        <h2>Practice in TAC</h2>
        <p>Use the case to draft your notes and tasks before answering. Your exam score comes from the seven questions below.</p>
        <ol>{STUDENT_LOAN_EXAM_CASE.exercise.map(step => <li key={step}>{step}</li>)}</ol>
      </section>
    </div>}
    <form onSubmit={submit}>
      {questions.map((question, index) => <fieldset key={question.prompt} disabled={busy}>
        <legend>{index + 1}. {question.prompt}</legend>
        {question.choices.map((choice, value) => <label className="tac-academy-choice" key={choice}>
          <input type="radio" name={`academy-exam-${index}`} checked={answers[index] === value}
            onChange={() => setAnswers(previous => previous.map((answer, i) => i === index ? value : answer))} />
          <span>{choice}</span>
        </label>)}
      </fieldset>)}
      <div className="tac-academy-actions">
        <button type="submit" className="crm-primary-btn" disabled={loading || busy || answers.includes(-1)}>Submit exam</button>
        <button type="button" className="crm-secondary-btn" disabled={busy} onClick={onBack}>Back to lessons</button>
      </div>
    </form>
  </section>
}
