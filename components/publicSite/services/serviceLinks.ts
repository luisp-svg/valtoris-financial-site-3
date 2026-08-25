import { ROUTES } from '../../../constants/routes'

export type ServiceLinks = {
  readonly primaryTo: string
  readonly secondaryTo: string
  readonly bridgePrimaryTo: string
  readonly bridgeSecondaryTo: string
  readonly finalPrimaryTo: string
  readonly finalSecondaryTo: string
  readonly relatedTo?: string
}

export function reportCardServiceLinks(diagnosticTo: string): ServiceLinks {
  return {
    primaryTo: diagnosticTo,
    secondaryTo: ROUTES.schedule,
    bridgePrimaryTo: diagnosticTo,
    bridgeSecondaryTo: ROUTES.schedule,
    finalPrimaryTo: diagnosticTo,
    finalSecondaryTo: ROUTES.schedule,
  }
}
