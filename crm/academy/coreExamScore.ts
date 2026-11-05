export const CORE_EXAM_TOTAL = 7
export const CORE_EXAM_PASS = 6

export function formatCoreExamScore(correct: number) {
  const percent = Math.round(correct * 100 / CORE_EXAM_TOTAL)
  return `${correct} of ${CORE_EXAM_TOTAL} (${percent}%)`
}
