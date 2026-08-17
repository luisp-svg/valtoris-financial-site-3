/**
 * Author for household Operational Notes. Always the authenticated CRM profile.
 * Never accept a user-picked author id.
 */
export function crmNoteAuthorUserId(
  profile: { id: string } | null | undefined,
): string | null {
  const id = profile?.id?.trim()
  return id || null
}
