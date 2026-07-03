import { useEffect, useState } from 'react'
import { REPORT_GRADE, getGradeTone } from '../reportCard/reportCardData'

type AnimatedScoreRingProps = {
  score: number
  grade?: string
  duration?: number
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3)
}

export default function AnimatedScoreRing({
  score,
  grade = REPORT_GRADE,
  duration = 900,
}: AnimatedScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(0)
  const radius = 88
  const circumference = 2 * Math.PI * radius
  const tone = getGradeTone(grade)
  const dashOffset = circumference - (displayScore / 100) * circumference

  useEffect(() => {
    const startTime = performance.now()
    let frameId = 0

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      setDisplayScore(Math.round(score * easeOutCubic(progress)))

      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [score, duration])

  return (
    <div className={`score-ring score-ring-${tone}`}>
      <svg className="score-ring-svg" viewBox="0 0 220 220" aria-hidden="true">
        <circle className="score-ring-track" cx="110" cy="110" r={radius} />
        <circle
          className="score-ring-fill"
          cx="110"
          cy="110"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="score-ring-center">
        <span className="score-ring-grade">{grade}</span>
        <span className="score-ring-score">{displayScore}</span>
        <span className="score-ring-max">/ 100</span>
      </div>
    </div>
  )
}
