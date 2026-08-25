import { Link, useLocation, type LinkProps } from 'react-router-dom'
import { readPublicLocale, withPublicLocale } from './locale'

type PublicLinkProps = Omit<LinkProps, 'to'> & {
  to: string
}

/**
 * Internal marketing link that preserves the active locale and
 * existing UTM / card / campaign query params.
 */
export default function PublicLink({ to, ...rest }: PublicLinkProps) {
  const location = useLocation()
  const locale = readPublicLocale(location.search)
  const href = withPublicLocale(to, locale, location.search)
  return <Link to={href} {...rest} />
}
