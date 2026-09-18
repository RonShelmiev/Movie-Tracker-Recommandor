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
