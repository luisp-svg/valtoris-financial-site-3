import { createSupabaseBrowserClient } from '../../lib/supabase/client'

export type AcademyProgress = {
  completed: string[]
  lastLesson: string
  correct: boolean | null
}

export async function fetchAcademyProgress(lesson?: string, choice?: number): Promise<AcademyProgress> {
  const { data, error } = await createSupabaseBrowserClient().rpc('academy_pilot_progress', {
    p_lesson: lesson ?? null,
    p_choice: choice ?? null,
  })
  if (error || !data || !Array.isArray(data.completed) || typeof data.lastLesson !== 'string') {
    throw new Error('Academy progress is unavailable.')
  }
  return data
}
