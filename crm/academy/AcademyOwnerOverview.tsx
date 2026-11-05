import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { CORE_EXAM_PASS, formatCoreExamScore } from './coreExamScore'
import { CORE_LESSONS } from './coreLessons'
import { PILOT_LESSONS } from './pilotLessons'

type AdvisorProgress = {
  advisor_id: string
  advisor_name: string
  completed: string[]
  last_lesson: string | null
  core_exam_best: number | null
}

export default function AcademyOwnerOverview() {
  const [rows, setRows] = useState<AdvisorProgress[] | null>(null)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { data, error } = await createSupabaseBrowserClient().rpc('academy_pilot_owner_overview')
        if (error || !Array.isArray(data)) throw new Error('Academy overview unavailable')
        if (active) setRows(data)
      } catch {
        if (active) setError(true)
      }
    }
    void load()
    return () => { active = false }
  }, [revision])

  return <section className="crm-panel" aria-labelledby="academy-owner-heading">
    <h1 id="academy-owner-heading">Advisor progress</h1>
    <p>Practice checks completed by active Valtoris advisors.</p>
    {error ? <>
      <p role="alert">Could not load advisor progress.</p>
      <button type="button" className="crm-secondary-btn" onClick={() => { setError(false); setRevision(n => n + 1) }}>Retry</button>
    </> : rows === null ? <p role="status">Loading advisor progress…</p>
      : rows.length === 0 ? <p>No active advisors found.</p>
      : <div className="tac-academy-progress-scroll" role="region" aria-label="Advisor training progress" tabIndex={0}>
        <table className="crm-opportunities-table">
          <thead><tr><th scope="col">Advisor</th><th scope="col">Core</th><th scope="col">Core exam best</th><th scope="col">Student loan</th><th scope="col">Last lesson</th></tr></thead>
          <tbody>{rows.map(row => {
            const coreCount = CORE_LESSONS.filter(lesson => row.completed.includes(lesson.id)).length
            const specialtyCount = PILOT_LESSONS.filter(lesson => row.completed.includes(lesson.id)).length
            const lastLesson = [...CORE_LESSONS, ...PILOT_LESSONS].find(lesson => lesson.id === row.last_lesson)
            return <tr key={row.advisor_id}>
              <th scope="row">{row.advisor_name}</th>
              <td>{coreCount} of {CORE_LESSONS.length}</td>
              <td>{row.core_exam_best == null ? 'Not taken' : `${formatCoreExamScore(row.core_exam_best)} · ${row.core_exam_best >= CORE_EXAM_PASS ? 'Passed' : 'Below passing mark'}`}</td>
              <td>{coreCount === CORE_LESSONS.length ? `${specialtyCount} of ${PILOT_LESSONS.length}` : 'Locked until Core is complete'}</td>
              <td>{lastLesson?.title ?? 'Not started'}</td>
            </tr>
          })}</tbody>
        </table>
      </div>}
  </section>
}
