import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
export const PREMIUM_COOKIE = "__Host-valtoris-assessment";
const LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export type AssessmentSession = { id: string; expires: number };
function signature(payload: string, secret: string): string {
  if (secret.length < 32) throw new Error("premium_session_not_configured");
  return createHmac("sha256", secret)
    .update(`valtoris-assessment-v1:${payload}`)
    .digest("base64url");
}
export function issueAssessmentSession(secret: string, now = Date.now()) {
  const session = { id: randomUUID(), expires: now + LIFETIME_MS };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return { session, token: `${payload}.${signature(payload, secret)}` };
}
export function readAssessmentSession(
  token: string,
  secret: string,
  now = Date.now(),
): AssessmentSession | null {
  try {
    if (token.length > 512) return null;
    const [payload, mac, extra] = token.split(".");
    if (!payload || !mac || extra) return null;
    const expected = Buffer.from(signature(payload, secret));
    const actual = Buffer.from(mac);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return null;
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AssessmentSession;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        session.id,
      ) ||
      !Number.isSafeInteger(session.expires) ||
      session.expires <= now ||
      session.expires > now + LIFETIME_MS
    )
      return null;
    return session;
  } catch {
    return null;
  }
}
export function assessmentCookieName(id: string): string {
  return `${PREMIUM_COOKIE}-${id}`;
}
export function assessmentCookie(token: string, id: string): string {
  return `${assessmentCookieName(id)}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${LIFETIME_MS / 1000}`;
}
