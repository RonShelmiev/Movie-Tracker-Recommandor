# Working agreement

## Deploying

**Merge to `main` without asking, once it is ready.** Ron works from a phone;
tapping through a PR flow on a small screen is friction he has opted out of.
After merging, send him the live link.

Ready means, at minimum:

- `npm run typecheck` and `npm run build` both pass
- the change has been **driven in a real browser**, not just compiled — this
  project has a history of bugs that only appear at runtime (a film citing
  itself as its own recommendation, a 170px `<select>` pushing every page
  sideways, poster art that rendered flat outside `.poster`)
- no route scrolls horizontally at 390px — audit every route, not a sample
- nothing that worked before is broken

If part of a change cannot be verified here, merge it but **say so plainly**.
Never imply something is tested when it is not.

## Verifying

There is no test suite. Behaviour is checked by driving the built app with
Playwright (`NODE_PATH=/opt/node22/lib/node_modules`, Chromium is at
`/opt/pw-browsers`). Serve `dist/` under a subpath to match GitHub Pages:

```bash
npm run build
mkdir -p /tmp/pages/Movie-Tracker-Recommandor && cp -r dist/* $_
(cd /tmp/pages && npx http-server -p 8088 -s)
```

Worth reproducing when touching stored state: plant `localStorage` with
`page.addInitScript`, not `page.evaluate` after load — the running app's
persist effect will otherwise overwrite it and the test lies.

## Environment limits

This sandbox blocks egress to `api.themoviedb.org`, `image.tmdb.org`,
Wikidata, and `*.github.io`. So the TMDB adapter cannot be exercised here —
mock it with `page.route('**://api.themoviedb.org/**')` to test the success
path. Google Fonts is blocked too; inject the faces inline for screenshots.

## Shape of the thing

- `src/lib/recommend.ts` — content-based engine. Taste is each score's
  distance from the user's own mean, so a below-average rating counts
  *against* a film's tags. Five weighted axes, hard rules applied before
  scoring, reasons generated from whichever axis actually drove the result.
- `src/lib/catalogue.tsx` — one provider over the bundled 89 films plus a
  cache of everything the user has touched. The cache is load-bearing: the log
  stores ids, and stats and recommendations need metadata synchronously and
  offline.
- `src/data/catalogue.ts` — years, directors and runtimes are real. `acclaim`
  and `ratingsK` are editorial estimates and should be described as such.
- Posters are procedural CSS gradients, backfilled with real TMDB artwork when
  a key is present.

Assets are content-hashed and old builds are deleted on deploy, so a cached
`index.html` can point at a bundle that no longer exists. `index.html` carries
a boot guard for exactly that — do not remove it.

**A service worker keeps installed copies current.** `public/sw.js` is network
first, always: every launch asks the server for the page and the cache is only
a fallback for offline or a slow connection. It exists because a home-screen
app was pinned to whatever build it was installed with. `scripts/inline.mjs`
stamps one build id into both `index.html` and `sw.js`, and the worker is
registered at a *constant* URL — the browser decides a worker is new by
comparing bytes at the same URL, so putting the version in the query string
leaves an open app re-fetching its own version and never noticing a newer one.
A cache-first worker would recreate the original bug; do not "optimise" the
ordering. The boot guard's recovery path unregisters the worker before
retrying, so a bad cached page cannot survive a reload.

**The build is single-file.** `scripts/inline.mjs` folds the JS and CSS into
`index.html` after `vite build`, and `dist/` ends up holding that one file. This
is deliberate: a separate `/assets/*.js` request has too many ways to fail on a
real device — a cached HTML pointing at a deleted hash, a path resolving wrong,
an intermediary dropping it — and each one shows as a blank page. Inlined, if
the HTML arrives the app runs. Do not "optimise" it back into separate chunks
without a much better reason than bundle hygiene.

**Vite `base` must stay absolute** (`/Movie-Tracker-Recommandor/`). A relative
base (`./`) looks harmless and works from the canonical URL, but any URL that
loses its trailing slash — `/Movie-Tracker-Recommandor?v=1`, which the boot
guard itself used to produce — resolves `./assets/...` against the domain root,
404s every script and stylesheet, and gives a blank white page. Test new URL
shapes (no slash, query string, hash route) before trusting a deploy.
