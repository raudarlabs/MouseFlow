/* The landing's own address, read once for the two places that need it: vite.landing.config.ts writes it
 * into the page's head (canonical, og:url, og:image, JSON-LD) and scripts/build-landing.mjs into
 * robots.txt and sitemap.xml. Plain JavaScript so both can import it - a build config and a node script -
 * without anything to compile it first.
 *
 * SITE_URL overrides the default, for a preview deployment or a move. Absolute, http(s), and returned
 * without a trailing slash so every caller can write `${site}/og.png`. A malformed value stops the build:
 * a canonical link pointing at nonsense would quietly take the site out of search. */
export function siteUrl(env = process.env) {
  const raw = String(env.SITE_URL || 'https://hivelink.si').trim().replace(/\/+$/, '');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('SITE_URL is not a URL: ' + JSON.stringify(raw));
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('SITE_URL must be http(s); got ' + raw);
  return url.origin + url.pathname.replace(/\/+$/, '');
}
