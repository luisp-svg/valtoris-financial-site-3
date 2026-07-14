type HomeCardIconProps = {
  variant:
    | 'grade'
    | 'protection'
    | 'blueprint'
    | 'session'
    | 'picture'
    | 'priorities'
    | 'strategy'
    | 'cashflow'
    | 'emergency'
    | 'debt'
    | 'retirement'
    | 'estate'
    | 'credit'
    | 'independence'
    | 'check'
}

export default function HomeCardIcon({ variant }: HomeCardIconProps) {
  return <span className={`home-card-icon home-card-icon-${variant}`} aria-hidden="true" />
}
