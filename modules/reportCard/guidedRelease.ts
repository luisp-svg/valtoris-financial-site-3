/** Enable the reviewed cards only after database and CRM release checks pass. */
export const guidedReportCardsEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_GUIDED_REPORT_CARDS === 'true'
