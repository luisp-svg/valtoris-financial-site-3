import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import AcademyCoreCertificate, { type CoreCertificate } from './AcademyCoreCertificate'
import { CORE_EXAM_QUESTIONS } from './coreExamQuestions'
import { CORE_EXAM_PASS, formatCoreExamScore } from './coreExamScore'

type Result = { score: number | null; best: number | null; certificate: CoreCertificate | null }

async function fetchResult(answers?: number[]): Promise<Result> {
  const { data, error } = await createSupabaseBrowserClient().rpc('academy_pilot_core_exam', { p_answers: answers ?? null })
  if (error || !data) throw new Error('Exam result unavailable')
  return data
}

export default function AcademyCoreExam({ onBack }: { onBack: () => void }) {
  const [answers, setAnswers] = useState<number[]>(() => CORE_EXAM_QUESTIONS.map(() => -1))
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const submitting = useRef(false)

  useEffect(() => {
    let active = true
    fetchResult().then(data => { if (active) setResult(data) }, () => {
      if (active) setError('Could not load your previous exam score. You can still submit an attempt.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading || submitting.current || answers.includes(-1)) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      setResult(await fetchResult(answers))
    } catch {
      setError('Could not grade the exam. Try submitting again.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <section className="crm-panel tac-academy-lesson">
    <h1>Valtoris Core exam</h1>
    <p>Answer all seven questions. Six correct answers meet the 85% passing mark. You can retry and your best score is saved.</p>
    {result?.best != null && <p>Best score: {formatCoreExamScore(result.best)} · {result.best >= CORE_EXAM_PASS ? 'Passed' : 'Below passing mark'}</p>}
    {result?.score != null && <p role="status">This attempt: {formatCoreExamScore(result.score)}</p>}
    {error && <p role="alert">{error}</p>}
    {result?.certificate && <AcademyCoreCertificate certificate={result.certificate} />}
    <form onSubmit={submit}>
      {CORE_EXAM_QUESTIONS.map((question, index) => <fieldset key={question.prompt} disabled={busy}>
        <legend>{index + 1}. {question.prompt}</legend>
        {question.choices.map((choice, value) => <label className="tac-academy-choice" key={choice}>
          <input type="radio" name={`core-exam-${index}`} checked={answers[index] === value}
            onChange={() => setAnswers(previous => previous.map((answer, i) => i === index ? value : answer))} />
          <span>{choice}</span>
        </label>)}
      </fieldset>)}
      <div className="tac-academy-actions">
        <button type="submit" className="crm-primary-btn" disabled={loading || busy || answers.includes(-1)}>Submit exam</button>
        <button type="button" className="crm-secondary-btn" disabled={busy} onClick={onBack}>Back to Core</button>
      </div>
    </form>
  </section>
}
