# hivelink.si — the landing

The Hivelink coming-soon page: one static, prerendered page built from the app's own design system — the
vendored `@insightis/ui` Button, Input, Badge, Card and Typography, the Arctic Honey palette
(`src/mouseflow-palette.css`), the app's fonts and the shared brand components in `src/components/brand/`
(`HiveMark`, `GlassHive`, `GlassCell`, `HiveTerminal`). Its waitlist form posts to the app deployment's
`/api/waitlist`.

| Where | What |
| --- | --- |
| `landing/index.html` | The page's head: title, description, canonical, Open Graph, Twitter card, JSON-LD. `__SITE_URL__` is replaced at build time. |
| `landing/public/` | `favicon.svg` (the app's, same file), `apple-touch-icon.png`, `og.png` (1200×630). |
| `landing/og.html`, `src/landing/og.tsx` | The template `og.png` and `apple-touch-icon.png` were rendered from. Never shipped. |
| `src/landing/` | The page (`Landing.tsx`), the form (`WaitlistForm.tsx`, `waitlist.ts`), the client and server entries, `landing.css`. |
| `vite.landing.config.ts` | The build: root `landing/`, `base: './'`, output `dist-landing/`, the same design-system aliases as `vite.config.ts`. |
| `scripts/build-landing.mjs` | Client build, server build, prerender into `dist-landing/index.html`, then `robots.txt` and `sitemap.xml`. |

## Commands (in `web/`)

```sh
npm run dev:landing      # http://localhost:4410, not prerendered (renders on the client)
npm run build:landing    # tsc, then dist-landing/ - static, prerendered, ready to upload
```

`build:landing` fails if the built page lacks the headline, the copy, the form, the canonical link or one
of the static files — an empty prerender would otherwise deploy and look fine in a browser.

## Deploy (a new Vercel project)

| Setting | Value |
| --- | --- |
| Root Directory | `web` |
| Framework Preset | Other |
| Build Command | `npm run build:landing` |
| Output Directory | `dist-landing` |
| Install Command | default (`npm install`) |
| Domains | `hivelink.si`, and `www.hivelink.si` redirecting to it |

Environment variables — both optional, both have defaults:

| Name | Default | Used for |
| --- | --- | --- |
| `SITE_URL` | `https://hivelink.si` | canonical, `og:url`, absolute `og:image`, JSON-LD, `robots.txt`, `sitemap.xml`. Set it on a preview deployment only if that preview should call itself canonical. |
| `VITE_WAITLIST_ENDPOINT` | `https://mouseflowapp.vercel.app/api/waitlist` | where the form posts. |

The API side must allow this origin: `/api/waitlist` answers CORS for `https://hivelink.si` and
`https://www.hivelink.si` (plus the app's own origins), and nothing else. A landing served from another
domain needs that list extended in `api/_cors.mjs`.

## The waitlist contract (both sides must match)

```
POST https://mouseflowapp.vercel.app/api/waitlist      Content-Type: application/json
{ "email": string, "website": "" (honeypot), "source": "landing", "ref": string <= 200 chars }

200 {"ok":true}                                   new, duplicate and honeypot all look the same
400 {"ok":false,"error":"invalid_email"}          shown as "check the address"
400 {"ok":false,"error":"bad_request"} | 413 | 5xx | network error   shown as "not saved, try again"
429 {"ok":false,"error":"rate_limited"}           shown as "try again in an hour or so" (5 tries per IP per hour)
```

`ref` is the utm tags and the referring **host** only (never the referrer's path or query). The page never
says "you're on the list" unless the server answered 2xx with `ok: true`.

## Re-rendering og.png and the touch icon

```sh
npm run dev:landing -- --port 4410
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless=new --hide-scrollbars --virtual-time-budget=8000 --window-size=1200,630 \
  --screenshot="$PWD/landing/public/og.png" http://localhost:4410/og.html
"$CH" --headless=new --hide-scrollbars --virtual-time-budget=6000 --window-size=180,180 \
  --screenshot="$PWD/landing/public/apple-touch-icon.png" "http://localhost:4410/og.html?icon"
```
