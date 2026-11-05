/** The pilot can be enabled in a local development server only. */
export const academyPilotEnabled = import.meta.env.DEV && import.meta.env.VITE_TAC_ACADEMY_PILOT === 'true'
