/* `npm run build:landing` - hivelink.si as a static, prerendered page in web/dist-landing.
 *
 * Three steps, all with vite.landing.config.ts:
 *   1. the client build: landing/index.html and its bundle, into dist-landing/;
 *   2. a server build of src/landing/entry-server.tsx into a scratch directory under node_modules, so its
 *      bare imports (react, react-dom/server) resolve against this package's own node_modules;
 *   3. render it, and put the markup into dist-landing/index.html where the comment marks #root - so the
 *      headline, the copy and the form are in the HTML a crawler or a link preview receives - add the
 *      FAQPage JSON-LD from the FAQ the page renders (sections/Faq.tsx, re-exported by entry-server.tsx),
 *      then write robots.txt and sitemap.xml for SITE_URL.
 *
 * The page is then checked for what it exists to carry. A prerender that silently produced an empty root
 * would still deploy, and still look right in a browser with JavaScript - the failure would only show in
 * search, weeks later.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { siteUrl } from '../src/landing/site-url.mjs';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const configFile = join(web, 'vite.landing.config.ts');
const out = join(web, 'dist-landing');
const ssrOut = join(web, 'node_modules', '.hivelink-landing-ssr');
const MARK = '<!--landing-ssr-->';

const site = siteUrl();
console.log('landing: SITE_URL ' + site);

await build({ configFile, mode: 'production' });

rmSync(ssrOut, { recursive: true, force: true });
await build({
  configFile,
  mode: 'production',
  logLevel: 'warn',
  publicDir: false,
  build: {
    ssr: join(web, 'src/landing/entry-server.tsx'),
    outDir: ssrOut,
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: { output: { entryFileNames: 'entry-server.mjs' } },
  },
});

const { render, FAQ } = await import(pathToFileURL(join(ssrOut, 'entry-server.mjs')).href);
const markup = render();
rmSync(ssrOut, { recursive: true, force: true });

const pagePath = join(out, 'index.html');
const page = readFileSync(pagePath, 'utf8');
if (!page.includes(MARK)) throw new Error('landing: ' + MARK + ' is missing from the built index.html');
/* The questions as structured data, from the very array the section renders - never a second copy. `<` is
   escaped so no answer can close the script element. */
const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};
const faqScript = '<script type="application/ld+json">' + JSON.stringify(faqLd).replace(/</g, '\\u003c') + '</script>\n';
const html = page.replace(MARK, () => markup).replace('</head>', () => faqScript + '</head>');
writeFileSync(pagePath, html);

writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
writeFileSync(
  join(out, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + `  <url><loc>${site}/</loc></url>\n`
    + '</urlset>\n',
);

/* What the static page must carry, checked on the file that will be served. */
const must = [
  ['the headline', /<h1[^>]*>[\s\S]*Every machine\.[\s\S]*One hive\.[\s\S]*<\/h1>/],
  ['the copy', /live AI agent on every Windows PC, Mac and test VM/],
  ['the form', /<form[^>]*id="waitlist"/],
  ['the second form, at the end', /<form[^>]*id="waitlist-final"/],
  ['01 How it tests', /Watch a live agent run it/],
  ['03 The night shift', /Read the verdict over coffee/],
  ['04 For IT', /It lives there\./],
  ['06 Use cases', /Real jobs\. Real screens\./],
  ['08 the FAQ', /Does the AI decide whether my test passed\?/],
  ['the FAQPage JSON-LD', (h) => {
    const m = h.match(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"FAQPage"[\s\S]*?)<\/script>/);
    try {
      return !!m && JSON.parse(m[1]).mainEntity.length === FAQ.length && FAQ.length > 0;
    } catch {
      return false;
    }
  }],
  ['the email field', /<input[^>]*type="email"/],
  ['the honeypot', /name="website"/],
  ['the canonical link', new RegExp(`<link rel="canonical" href="${site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/">`)],
  ['no unreplaced placeholder', (h) => !h.includes('__SITE_URL__')],
];
const missing = must.filter(([, test]) => !(typeof test === 'function' ? test(html) : test.test(html))).map(([what]) => what);
for (const f of ['og.png', 'favicon.svg', 'apple-touch-icon.png', 'robots.txt', 'sitemap.xml']) {
  if (!existsSync(join(out, f))) missing.push(f);
}
if (missing.length) throw new Error('landing: the built page is missing ' + missing.join(', '));
console.log('landing: prerendered ' + markup.length + ' bytes into dist-landing/index.html');
