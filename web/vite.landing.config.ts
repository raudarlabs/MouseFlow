/* The landing's build: hivelink.si, one static page, from the app's own components.
 *
 * A second Vite config rather than a second entry in vite.config.ts, because the two ship to different
 * places - the app to its Vercel project, the landing to its own (see landing/README.md) - and share
 * nothing at runtime but the design system. Same React plugin, same aliases, same Tailwind config and
 * stylesheet, so a Button on the landing is the admin's Button.
 *
 * ROOT IS landing/. Its index.html is the entry and landing/public/ its public directory (favicon, og.png,
 * apple-touch-icon); the code it loads lives in src/ like the app's. `base: './'` so the built page works
 * from any path, and from a file:// URL when screenshots are taken of it.
 *
 * `npm run build:landing` drives this through scripts/build-landing.mjs, which runs the client build here,
 * then a server build of src/landing/entry-server.tsx, and pours the rendered markup into the page.
 * `npm run dev:landing` serves it unrendered, which is fine for working on it: main.tsx renders an empty
 * root instead of hydrating it.
 */
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { type Plugin, defineConfig } from 'vite';
import { siteUrl } from './src/landing/site-url.mjs';
import appTailwind from './tailwind.config';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const ui = (p: string) => here('./vendor/insightis-ui/' + p);

/* vite.config.ts's DESIGN_SYSTEM, restated: that file does not export it, and importing it would run the
 * app's config (its mock API, its Sentry switch) inside this one. web/check-web.mjs holds the two lists to
 * the same text, so they cannot drift apart unnoticed. */
const DESIGN_SYSTEM = [
  { find: '@insightis/ui/cn', replacement: ui('src/lib/utils.ts') },
  { find: '@insightis/ui/use-mobile', replacement: ui('src/hooks/use-mobile.tsx') },
  { find: '@insightis/ui/globals.css', replacement: ui('src/globals.css') },
  { find: /^@insightis\/ui\/(.+)$/, replacement: ui('src/components/$1/index.tsx') },
  { find: /^@\/hooks\/(.+)$/, replacement: ui('src/hooks/$1') },
];

/** The vendored components the landing renders, and the ones they render (Button draws a Spinner). */
const LANDING_UI = ['Badge', 'Button', 'IconButton', 'Input', 'Spinner', 'Typography'];

/* In the HTML only. `__SITE_URL__` rather than Vite's `%NAME%`, which is reserved for VITE_ env vars and
 * warns about anything else. */
const siteUrlInHtml = (): Plugin => ({
  name: 'hivelink-site-url',
  transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('__SITE_URL__', siteUrl()) },
});

export default defineConfig({
  root: here('./landing'),
  base: './',
  publicDir: here('./landing/public'),
  /* .env files are looked for next to this config, as the app's are, not inside landing/. */
  envDir: here('.'),
  plugins: [react(), siteUrlInHtml()],
  resolve: {
    alias: [
      ...DESIGN_SYSTEM,
      { find: '@', replacement: here('./src') },
      /* The pages' <script src="/src/landing/...">: a URL cannot climb above the root, so the HTML names
       * the entry as if src/ were inside landing/, and this says where it really is - in dev and build. */
      { find: /^\/src\/landing\//, replacement: here('./src/landing/') },
    ],
  },
  /* Stated here because the root is landing/ and PostCSS would otherwise look for its config from there.
   *
   * The Tailwind config is the app's - same preset, same faces, same tokens - with one change: WHERE it
   * looks for class names. The app's globs cover every screen of the admin, and the landing would ship
   * every utility the admin uses (143 kB of CSS for one page). Narrowed to the landing, the brand
   * components and the vendored components the landing renders, it ships what it draws. A vendored
   * component added to the page has to be added here too, or its classes are silently missing - which is
   * why web/check-web.mjs compares this list with the landing's @insightis/ui imports. */
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          ...appTailwind,
          /* The pages themselves too: landing/index.html is where class="dark" is set, and the design
           * system's dark tokens are written under `.dark` in a Tailwind layer, which Tailwind keeps only
           * when the class is seen in the content. Without the HTML the theme would hang on the word
           * "dark" happening to appear in some comment. */
          content: [
            here('./landing/*.html'),
            here('./src/landing/**/*.{ts,tsx}'),
            here('./src/components/brand/**/*.{ts,tsx}'),
            here('./vendor/insightis-ui/src/components/{' + LANDING_UI.join(',') + '}/**/*.tsx'),
          ],
        }),
        autoprefixer(),
      ],
    },
  },
  server: {
    port: 4410,
    /* The page's code lives one level up, in src/. */
    fs: { allow: [here('.')] },
  },
  build: {
    outDir: here('./dist-landing'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
  },
});
