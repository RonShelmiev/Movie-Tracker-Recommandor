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

## Measuring the recommender

"Are these good picks?" has no answer without knowing whose taste they are
for, so the metric is self-consistency: hide one film someone rated, ask the
engine how well it matches them, and check that films they rated highly come
back scoring higher. Spearman rho between predicted match and actual score,
over several synthetic personas with a stated preference.

The bench lives in the scratchpad during development — bundle the real engine
with esbuild and run it in Node, no browser needed:

```bash
npx esbuild bench.ts --bundle --platform=node --format=esm --outfile=bench.mjs
node bench.mjs
```

It also prints each axis's `sd x weight` across the catalogue, which is what
influence actually means — an axis with a high weight but almost no spread
(`community`, or `people` before the rewrite, which had eight distinct values
across 89 films) contributes nothing while looking important.

Mean rho was 0.485 before the October rewrite and 0.811 after, on four
personas. The set then grew to nine — three that compress their scores into
part of the scale, two whose taste is a *combination* no single tag expresses
— and on that harder set it reads 0.757 before the my-scores-only pass and
0.779 after.

Two things measured as *not* worth shipping, so do not re-add them on
intuition: an aversion term in `similarity` (penalising resemblance to films
rated below your mean) came out flat or worse, because tag affinity already
carries it; and the old acclaim axis, built on the editorial `acclaim`
estimates, moved 0 of 10 picks at any weight because they have no spread.

The October 16 pass rebuilt the bench harder (random 30-film libraries out
of 89, noisy scores, nine personas): 0.482 at the start. Changes measured
on it:

- `similarity` compares against the **3 nearest** favourites, not a
  weighted mean over all of them, and the top-12 cap on favourites is gone.
  Averaged, a near-twin of one favourite was diluted by every unrelated
  one, which is how Ron's 9.4 for Blade Runner 2049 left Blade Runner at
  40%. Swept k = 1, 2, 3, 5: 3 is best (0.484).
- A favourite's weight has an **absolute floor**: anything above 8.5 counts
  for something even when it is at or below a generous rater's mean. Only
  `similarity` uses it. Anchoring the whole neutral point toward an
  absolute 7 instead was tried and *rejected*: it wrecked the persona who
  rates 8.5-10 (0.88 -> 0.23).
- **Sequels and originals** (shared title stem, "Blade Runner" /
  "Blade Runner 2049") get kinship 0.85; the same director adds 0.12.
- **Real IMDb ratings** (`src/data/imdb.ts`, from IMDb's datasets) replace
  the editorial acclaim, on by default (`useImdb`) at weight 40. Unlike the
  estimates they help: 0 -> 0.484, 40 -> 0.498, 60 -> 0.506.

Final: 0.498. For the Ron-shaped library Blade Runner went 81% / rank 8 to
93% / rank 3.

## Environment limits

This sandbox blocks egress to `api.themoviedb.org`, `image.tmdb.org`,
Wikidata, and `*.github.io`. So the TMDB adapter cannot be exercised here —
mock it with `page.route('**://api.themoviedb.org/**')` to test the success
path. Google Fonts is blocked too; inject the faces inline for screenshots.

## Shape of the thing

- `src/lib/recommend.ts` — content-based engine. Taste is each score's
  distance from the user's own mean, so a below-average rating counts
  *against* a film's tags. Six weighted axes, hard rules applied before
  scoring, reasons generated from whichever axis actually drove the result.
  `similarity` — how close a candidate is to the films you rated highest,
  Jaccard over tags and genres — carries the most weight, because averages
  over tags cannot express a combination: "slow" and "space" both score well
  one at a time without ever saying that slow space films are the point.
  Changing the scoring means re-running the leave-one-out bench (below), not
  eyeballing one list.

  Weights stored before `similarity` existed are *replaced* rather than
  merged: the axes were redefined, so the old numbers no longer mean the
  same thing.

  The percentage is an S-curve over raw (`MATCH_CENTRE`, `MATCH_STEEPNESS`),
  not a straight scale: raw lives in roughly 0.35-0.75, so the old `raw *
  1.06` capped the best pick for a real library near 72%. It is display
  only — ranking is on raw, so the bench cannot see it. After touching it,
  check the spread instead: top pick 90-98 for libraries with real spread in
  their scores, around 70 for an all-7.5 first-run library.

  The crowd enters through `useImdb` (on by default, at Ron's later request):
  IMDb's rating for bundled films, TMDB's average for searched ones, never
  the editorial `acclaim`. A film you have rated shows your score, not a
  match — on its page and on Browse posters.
- `src/lib/catalogue.tsx` — one provider over the bundled 89 films plus a
  cache of everything the user has touched. The cache is load-bearing: the log
  stores ids, and stats and recommendations need metadata synchronously and
  offline.
- `src/data/catalogue.ts` — years, directors and runtimes are real. `acclaim`
  and `ratingsK` are editorial estimates and should be described as such.
- The bundled films ship their TMDB poster paths (`src/data/posters.ts`), so
  real artwork shows with no key; procedural CSS gradients sit underneath as
  the fallback. A key backfills posters only for films outside that list.

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
