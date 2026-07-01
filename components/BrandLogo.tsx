import { useState } from 'react'

export const LOGO_SRC = '/valtoris-logo.png'

type BrandLogoProps = {
  className?: string
  onMissing?: () => void
}

export default function BrandLogo({ className = '', onMissing }: BrandLogoProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    onMissing?.()
    return null
  }

  return (
    <img
      src={LOGO_SRC}
      alt="Valtoris Financial"
      className={className}
      onError={() => {
        setFailed(true)
        onMissing?.()
      }}
    />
  )
}
