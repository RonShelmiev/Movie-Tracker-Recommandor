# Flick

A personal film tracker and recommender. Log what you have seen, keep a list of what
you mean to watch, and get suggestions that explain themselves.

Neon-noir interface — the full design lives on the
[design canvas](https://claude.ai/code/artifact/27ea89e4-3505-40d8-93d9-afba399a2b07),
with the source artboards in [`design/`](design/).

## Live site

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`.

**One-time setup, which has to be done by hand in the repo:**
Settings → Pages → Build and deployment → Source → **GitHub Actions**.
Until that is set, the workflow runs and the deploy step fails.

Routing uses `HashRouter` (`/#/browse`), because GitHub Pages has no SPA
fallback — a path-based route would 404 on refresh or on a shared deep link.
The build uses an absolute base (`/Movie-Tracker-Recommandor/`) — see
`CLAUDE.md` for why a relative one gave blank pages.

## Running it

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # typecheck + production bundle
npm run typecheck
```

No backend and no API keys required. Everything you log is kept in `localStorage`
under `flick.v1`; a TMDB key and cloud sync are both optional (below).

## What is here

| Screen | Route | What it does |
|---|---|---|
| First run | `/welcome` | Seeds a brand new library — pick five films you have seen |
| Dashboard | `/` | Tonight's pick, your counts, next up, recent log, taste signal |
| Browse | `/browse` | The whole catalogue, filtered by genre, decade and unseen-only |
| Film | `/film/:id` | Synopsis, your log and scores, why it fits you, similar films |
| To see | `/to-see` | The queue, ranked by match, with why each film is on it |
| Seen | `/seen` | History by month, films per month, genre breakdown, best of year |
| For you | `/for-you` | Ranked recommendations, each showing which logged film produced it |
| Tune my taste | `/settings` | Signal weights and hard rules, with a live preview of the effect |

"Log a film" is a modal available from anywhere, so logging never loses your place.

## How the recommender works

`src/lib/recommend.ts`. It is content-based — with one user there is nobody to
collaborate with — and every number it shows is derived from what you have logged.

1. **Taste profile.** Each logged film's tags, genres, director and decade are
   weighted by `score − yourMeanScore`. Rating something below your own average
   counts *against* its tags, which is what stops the profile drifting toward
   whatever you happen to watch a lot of.
2. **Five axes**, each normalised to 0–1: people you rate highly, genre/mood
   affinity, runtime fit (a gaussian around the runtimes you actually finish),
   era, and community acclaim.
3. **Your weights** from `/settings` combine those into a match score. Turning
   community acclaim up genuinely reorders the list toward the canon; turning it
   down surfaces the obscure.
4. **Hard rules** filter before scoring: runtime ceiling, excluded genres,
   dismissed films, anything already on your list, and **anything you have
   seen**. A film counts as seen under every id it goes by — the bundled copy
   and a TMDB copy of the same title and year are one film. Rewatches are off
   by default; switched on, they are limited to films you rated well (7.5+ and
   above your own average) at least 180 days ago, one per eight picks, never in
   the top three.
5. **Reasons** are generated from whichever axis actually drove the score, and
   each recommendation is traced back to the logged film with the strongest tag
   overlap — that is what "where these came from" on `/for-you` is showing.

## The catalogue

Two sources, behind one provider (`src/lib/catalogue.tsx`).

**Bundled (default).** `src/data/catalogue.ts` holds 89 hand-curated films. Years,
directors and runtimes are real; **`acclaim` and `ratingsK` are editorial
estimates, not real ratings data**, and the `tags` are my own vocabulary. Posters
are procedural — eight CSS gradient treatments. Nothing is fetched, so it works
offline with no key.

**TMDB (optional).** Paste a free [TMDB key](https://www.themoviedb.org/settings/api)
into *Tune my taste* and the whole index opens up, with real posters. The key is
kept in `localStorage`, never committed. `VITE_TMDB_KEY` works too, but a key baked
into the bundle is visible to anyone who opens the site — use one you do not mind
exposing, and prefer the in-app field.

Hit **Test connection** in Settings to round-trip a known film and see exactly what
came back and how it mapped.

Verified against the live API in October 2026, with both a v3 key and a v4
read token: every endpoint returns the shapes the adapter expects, and all 89
bundled films resolve to the right TMDB entry with a poster. A direct link to a
TMDB film that is not cached yet is fetched on open.

Every film you touch is cached in `localStorage` under `flick.films.v1`. That is not
an optimisation: the log stores ids, and stats and recommendations need the metadata
synchronously and offline.

### Where TMDB data is weaker

TMDB has no notion of "slow" or "bleak", so the recommender's editorial tags are
derived from TMDB *keywords* via a hand-written mapping in `src/lib/tmdb.ts`.
Each pattern must match a whole keyword — substring matching used to read
"train" and "Ukraine" as *rain*. The keywords were chosen from what TMDB actually
attaches to the bundled films carrying each hand tag. Measured against those 89
hand-tagged films, the derived tags agree 63% of the time and recover 47% of the
hand tags. Most of the misses are tags TMDB has no keyword for at all
(`long-take`, `minimal-score`, `rain`), so films from TMDB still come through
under-tagged compared with the bundled ones. *Neo-noir* is a genre here but only
a keyword on TMDB, so it is mapped from the keyword. *Blockbuster* comes from the
budget in today's money (over about $100M), not from vote count, which used to
make Memento and Taxi Driver blockbusters.

## Cloud sync (optional)

Without it Flick keeps everything in one browser's `localStorage` — which is also
why a home-screen install starts empty: iOS gives an installed web app its own
storage container.

Turning it on means bringing your own [Supabase](https://supabase.com) project;
there is no server behind this app and nothing is hosted centrally. Your films
go into your project, and nobody else — including whoever wrote this — can read
them.

1. Create a free project.
2. Run this once in its SQL editor:

```sql
create table if not exists flick_state (
  user_id uuid primary key references auth.users on delete cascade,
  state jsonb not null,
  films jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table flick_state enable row level security;

create policy "own row" on flick_state
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

3. Paste the Project URL and the **anon public** key into *Tune my taste →
   Your account*, then create an account.

The anon key is designed to ship in a browser; what keeps rows private is the
policy above, which limits every read and write to `auth.uid()`. Row-level
security is the whole protection here — without that `create policy` line the
table is readable by anyone holding the anon key.

`src/lib/cloud.ts` talks to Supabase's REST endpoints directly rather than
through the SDK: the surface needed is four auth calls and two table calls, and
the build is deliberately a single file.

### How merging works

Both devices hold the same library at different moments, so `mergeForSync` in
`src/lib/backup.ts` matches log entries on `id` and keeps whichever carries the
later `updatedAt`. Deletions are recorded as tombstones (`deletedLogIds`),
because a union merge otherwise cannot tell "deleted on the other device" from
"not seen here yet" and quietly puts the film back.

Edits made on two devices while both are offline still resolve last-write-wins
per entry, which for one person is the right trade.

## Updating

The app updates itself. A service worker (`public/sw.js`) fetches the page from
the network on every launch and falls back to its cache only when offline or
when the network is too slow to wait for, so opening Flick gets you the current
build — including when it has been added to a home screen, which previously
pinned it to the build it was installed with.

A deploy that lands while the app is already open shows a reload bar rather
than pulling the page out from under you. *Tune my taste → Version* shows the
running build id and has a Force refresh that drops the offline copy and
refetches; it does not touch logged films, the list or any keys.

## Known gaps

- Cloud sync is written against Supabase's documented contract but has **not**
  been exercised against a live project — the sandbox it was built in blocks
  egress to `supabase.co`. It is covered end to end by a mock
  (two devices, merge, deletion, token refresh, wrong password); `Test project`
  in Settings checks a real one in a tap.
- Recommendations score a local candidate pool: the bundled films plus every
  film you have touched. `expandPool()` can pull more by your strongest genres,
  but **nothing in the UI calls it yet**.
- CSV / Letterboxd import is designed but not implemented; JSON backup
  export/import is.
- No automated tests. Behaviour is verified by driving the real app in a browser
  (`scratchpad/drive*.js` during development), which has caught real bugs, but
  nothing guards against regressions in CI.
