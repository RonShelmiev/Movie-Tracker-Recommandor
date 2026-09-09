# Flick

A personal film tracker and recommender. Log what you have seen, keep a list of what
you mean to watch, and get suggestions that explain themselves.

Neon-noir interface — the full design lives on the
[design canvas](https://claude.ai/code/artifact/27ea89e4-3505-40d8-93d9-afba399a2b07),
with the source artboards in [`design/`](design/).

## Running it

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # typecheck + production bundle
npm run typecheck
```

No backend, no accounts, no API keys. Everything you log is kept in `localStorage`
under `flick.v1` and never leaves the browser.

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
   dismissed films, anything already on your list, and films logged in the last
   180 days (so a rewatch has had time to become one).
5. **Reasons** are generated from whichever axis actually drove the score, and
   each recommendation is traced back to the logged film with the strongest tag
   overlap — that is what "where these came from" on `/for-you` is showing.

## The catalogue

`src/data/catalogue.ts` holds 89 hand-curated films. Years, directors and runtimes
are real; **`acclaim` and `ratingsK` are editorial estimates, not real ratings
data**, and the `tags` are my own editorial vocabulary rather than anything
canonical.

Posters are procedural — eight CSS gradient treatments assigned per film. Nothing
is fetched, so there is no key art to license and no network dependency.

To swap in a real index (TMDB, OMDb, Wikidata), replace `CATALOGUE` with a fetched
list conforming to `Film` in `src/lib/types.ts`. The recommender needs `tags` to be
populated to do anything interesting, so a real source would want either a keyword
mapping or an editorial pass.

## Known gaps

- Single user, single device. No sync, no accounts.
- The catalogue is a starter set, not an index of everything.
- CSV / Letterboxd import is designed but not implemented.
- No mobile layout yet — the rail hides below 860px but the screens are still
  desktop-shaped.
