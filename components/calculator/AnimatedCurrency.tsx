import { useEffect, useState } from 'react'
import { formatCurrency } from './calculations'

type AnimatedCurrencyProps = {
  value: number
  duration?: number
  className?: string
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3)
}

export default function AnimatedCurrency({
  value,
  duration = 500,
  className,
}: AnimatedCurrencyProps) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const startTime = performance.now()
    let frameId = 0

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easeOutCubic(progress)
      setDisplayValue(Math.round(value * easedProgress))

      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [value, duration])

  return <span className={className}>{formatCurrency(displayValue)}</span>
}
