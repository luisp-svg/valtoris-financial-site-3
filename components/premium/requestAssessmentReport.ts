/** Retry only the private report read; never reserve a slot or unlock results locally. */
export async function requestAssessmentReport(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(20000),
        cache: 'no-store',
      });
      if (attempt === 1 || ![502, 503, 504].includes(response.status)) return response;
    } catch (error) {
      if (attempt === 1) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('verification_unavailable');
}
