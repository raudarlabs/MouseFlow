/* The landing's half of the waitlist contract, kept free of React and of imports so web/check-web.mjs can
 * run it against a stubbed fetch.
 *
 * THE CONTRACT (shared with api/waitlist on the app deployment; both sides must match exactly):
 *   POST <endpoint>   Content-Type: application/json
 *   { email, website (honeypot, must be empty), source: "landing", ref (<= 200 chars, optional) }
 *   200 {"ok":true}                       - new, duplicate and honeypot all look the same
 *   400 {"ok":false,"error":"invalid_email"|"bad_request"} ; 413 ; 429 {"error":"rate_limited"} ; 405
 *
 * NEVER A FAKE SUCCESS. The concept's form said "you are on the list" without sending anything. Here the
 * only path to 'ok' is a 2xx whose body says ok:true; a network error, a timeout, a 5xx, an HTML error page
 * from a proxy - all of them are 'failed', and the visitor is told to try again rather than told they are
 * in when they are not.
 */

export const DEFAULT_WAITLIST_ENDPOINT = 'https://mouseflowapp.vercel.app/api/waitlist';

export type WaitlistOutcome = 'ok' | 'invalid_email' | 'rate_limited' | 'failed';

/** Deliberately loose: one @, something on each side, a dot in the domain. The server is the judge. */
export const looksLikeEmail = (v: string) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const REF_MAX = 200;
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref'];

/** Where the visitor came from, in at most 200 characters: the utm tags and the referring HOST.
 *
 * Only the host of the referrer, never its path or query - a referrer URL can carry somebody's search terms
 * or a session token from the page they were on, and none of that is ours to store. A referrer from this
 * same site is not a source and is dropped. */
export function refSummary(search: string, referrer: string, ownHost: string): string {
  const parts: string[] = [];
  let params: URLSearchParams | null = null;
  try {
    params = new URLSearchParams(search);
  } catch {
    params = null;
  }
  for (const k of UTM) {
    const v = params?.get(k)?.trim();
    if (v) parts.push(k + '=' + v.slice(0, 60));
  }
  if (referrer) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, '');
      if (host && host !== ownHost.replace(/^www\./, '')) parts.push('from=' + host);
    } catch {
      /* not a URL - nothing to say */
    }
  }
  return parts.join(';').slice(0, REF_MAX);
}

export interface WaitlistRequest {
  email: string;
  /** The honeypot's value, sent as-is: a person leaves it empty, and the server decides what a bot gets. */
  website: string;
  ref: string;
}

export async function joinWaitlist(
  endpoint: string,
  req: WaitlistRequest,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 15000,
): Promise<WaitlistOutcome> {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: req.email, website: req.website, source: 'landing', ref: req.ref.slice(0, REF_MAX) }),
      /* No cookies to a different origin: the endpoint never allows credentials, and the landing has none. */
      credentials: 'omit',
      signal: ctrl?.signal,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const error = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
    if (res.ok && body && typeof body === 'object' && (body as { ok?: unknown }).ok === true) return 'ok';
    if (res.status === 429 || error === 'rate_limited') return 'rate_limited';
    if (res.status === 400 && error === 'invalid_email') return 'invalid_email';
    return 'failed';
  } catch {
    return 'failed';
  } finally {
    if (timer) clearTimeout(timer);
  }
}
