import type { AppState, Film, Genre, LogEntry, Recommendation, Settings, Tag } from './types';

/**
 * Content-based recommender.
 *
 * The taste profile is built from how far each logged score sits from your own
 * mean, so a 7.0 from someone who averages 8.5 counts against a film's tags.
 * Nothing here is collaborative — with one user there is nobody to collaborate
 * with — so everything is derived from the tags, genres, people and runtimes
 * of what you have actually logged.
 */

export interface Taste {
  n: number;
  meanScore: number;
  tag: Map<Tag, number>;
  genre: Map<Genre, number>;
  director: Map<string, { mean: number; n: number }>;
  /** Runtime you gravitate to, weighted toward films you rated well. */
  runtimeMean: number;
  runtimeSd: number;
  decade: Map<number, number>;
}

const EMPTY_TASTE: Taste = {
  n: 0,
  meanScore: 7,
  tag: new Map(),
  genre: new Map(),
  director: new Map(),
  runtimeMean: 115,
  runtimeSd: 35,
  decade: new Map(),
};

function normalise<K>(m: Map<K, number>): Map<K, number> {
  let max = 0;
  for (const v of m.values()) max = Math.max(max, Math.abs(v));
  if (max === 0) return m;
  const out = new Map<K, number>();
  for (const [k, v] of m) out.set(k, v / max);
  return out;
}

export function buildTaste(log: LogEntry[], getFilm: (id: string) => Film | undefined): Taste {
  const rated = log
    .map((e) => ({ e, f: getFilm(e.filmId) }))
    .filter((x): x is { e: LogEntry; f: Film } => Boolean(x.f));

  if (rated.length === 0) return EMPTY_TASTE;

  const meanScore = rated.reduce((s, x) => s + x.e.score, 0) / rated.length;

  const tag = new Map<Tag, number>();
  const genre = new Map<Genre, number>();
  const decade = new Map<number, number>();
  const byDirector = new Map<string, number[]>();

  let rtWeight = 0;
  let rtSum = 0;

  for (const { e, f } of rated) {
    // Above your own mean counts for, below counts against.
    const lift = e.score - meanScore;
    for (const t of f.tags) tag.set(t, (tag.get(t) ?? 0) + lift);
    for (const g of f.genres) genre.set(g, (genre.get(g) ?? 0) + lift);
    const dec = Math.floor(f.year / 10) * 10;
    decade.set(dec, (decade.get(dec) ?? 0) + lift);

    const list = byDirector.get(f.director) ?? [];
    list.push(e.score);
    byDirector.set(f.director, list);

    // Films you liked pull the preferred runtime harder than ones you did not.
    const w = Math.max(0.1, e.score / 10);
    rtWeight += w;
    rtSum += f.runtime * w;
  }

  const runtimeMean = rtSum / rtWeight;
  const variance =
    rated.reduce((s, { f }) => s + (f.runtime - runtimeMean) ** 2, 0) / rated.length;

  const director = new Map<string, { mean: number; n: number }>();
  for (const [d, scores] of byDirector) {
    director.set(d, { mean: scores.reduce((a, b) => a + b, 0) / scores.length, n: scores.length });
  }

  return {
    n: rated.length,
    meanScore,
    tag: normalise(tag),
    genre: normalise(genre),
    director,
    runtimeMean,
    runtimeSd: Math.max(20, Math.sqrt(variance)),
    decade: normalise(decade),
  };
}

/** 0..1 for each axis, before the user's weights are applied. */
interface Components {
  people: number;
  affinity: number;
  runtimeFit: number;
  era: number;
  community: number;
}

function components(film: Film, taste: Taste): Components {
  const dir = taste.director.get(film.director);
  const people = dir
    ? clamp01(0.5 + (dir.mean - taste.meanScore) / 4 + Math.min(dir.n, 4) * 0.02)
    : 0.35;

  let affSum = 0;
  for (const t of film.tags) affSum += taste.tag.get(t) ?? 0;
  for (const g of film.genres) affSum += (taste.genre.get(g) ?? 0) * 1.4;
  const affDenom = film.tags.length + film.genres.length * 1.4;
  // A film with neither tags nor genres divides 0 by 0, and NaN then
  // propagates through the weighted sum all the way to the displayed match.
  // `isRecommendable` keeps those out, but the guard stays: a NaN here is
  // invisible until it reaches the screen as "NaN% MATCH".
  const affinity = affDenom > 0 ? clamp01(0.5 + affSum / (affDenom * 2)) : 0.5;

  const z = (film.runtime - taste.runtimeMean) / taste.runtimeSd;
  const runtimeFit = Math.exp(-(z * z) / 2);

  const dec = Math.floor(film.year / 10) * 10;
  const era = clamp01(0.5 + (taste.decade.get(dec) ?? 0) / 2);

  const community = film.acclaim / 100;

  return { people, affinity, runtimeFit, era, community };
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

const TAG_PHRASES: Partial<Record<Tag, string>> = {
  cerebral: 'films that make you work',
  slow: 'slow cinema',
  bleak: 'films with no comfort in them',
  'long-take': 'long takes',
  'minimal-score': 'films that stay quiet',
  'noir-lighting': 'noir lighting',
  rain: 'rain and wet streets',
  'city-at-night': 'cities at night',
  space: 'space',
  ai: 'artificial minds',
  memory: 'unreliable memory',
  'time-loop': 'time loops',
  surveillance: 'surveillance',
  dystopia: 'dystopias',
  'body-horror': 'body horror',
  'practical-fx': 'practical effects',
  arthouse: 'arthouse',
  desert: 'deserts',
  procedural: 'procedurals',
  anime: 'animation',
  grief: 'films about grief',
  satire: 'satire',
  'one-location': 'single-location films',
  twist: 'films that turn over',
  stylish: 'style over plot',
  ensemble: 'ensembles',
};

function overlap(a: Film, b: Film): number {
  const bt = new Set<string>([...b.tags, ...b.genres]);
  let n = 0;
  for (const t of [...a.tags, ...a.genres]) if (bt.has(t)) n += 1;
  return n;
}

/**
 * How much a candidate looks like the films you pointed at, 0..1. Measured
 * against the smaller of the two tag sets so a sparsely tagged film is not
 * punished for having less to match with.
 */
function seedAffinity(film: Film, seeds: Film[]): number {
  let best = 0;
  for (const s of seeds) {
    const denom = Math.max(
      1,
      Math.min(film.tags.length + film.genres.length, s.tags.length + s.genres.length),
    );
    best = Math.max(best, overlap(film, s) / denom);
  }
  return clamp01(best);
}

/** The logged film that most explains this recommendation. */
export function nearestSeed(
  film: Film,
  log: LogEntry[],
  getFilm: (id: string) => Film | undefined,
  meanScore: number,
): { film: Film; entry: LogEntry } | null {
  let best: { film: Film; entry: LogEntry } | null = null;
  let bestScore = 0;
  for (const entry of log) {
    if (entry.filmId === film.id) continue; // a film cannot be its own reason
    const seed = getFilm(entry.filmId);
    if (!seed || entry.score < meanScore) continue;
    const s = overlap(film, seed) * (1 + (entry.score - meanScore) / 5);
    if (s > bestScore) {
      bestScore = s;
      best = { film: seed, entry };
    }
  }
  return bestScore >= 2 ? best : null;
}

const REWATCH_AFTER_DAYS = 180;

/** The most recent time this film was logged, or null. */
function lastWatched(film: Film, log: LogEntry[]): LogEntry | null {
  let best: LogEntry | null = null;
  for (const e of log) {
    if (e.filmId !== film.id) continue;
    if (!best || e.watchedOn > best.watchedOn) best = e;
  }
  return best;
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function reasonsFor(
  film: Film,
  taste: Taste,
  c: Components,
  log: LogEntry[],
  getFilm: (id: string) => Film | undefined,
  settings: Settings,
): string[] {
  const out: string[] = [];

  const own = lastWatched(film, log);
  if (own) {
    out.push(
      `You rated this ${own.score.toFixed(1)} in ${own.watchedOn.slice(0, 4)} — due a rewatch`,
    );
  }

  const seed = nearestSeed(film, log, getFilm, taste.meanScore);
  if (seed) out.push(`Because you rated ${seed.film.title} ${seed.entry.score.toFixed(1)}`);

  const dir = taste.director.get(film.director);
  if (dir && dir.mean > taste.meanScore + 0.2) {
    out.push(`You rate ${film.director} ${dir.mean.toFixed(1)} on average`);
  }

  let bestTag: Tag | null = null;
  let bestWeight = 0.25;
  for (const t of film.tags) {
    const w = taste.tag.get(t) ?? 0;
    if (w > bestWeight) {
      bestWeight = w;
      bestTag = t;
    }
  }
  if (bestTag && TAG_PHRASES[bestTag]) out.push(`Your taste runs to ${TAG_PHRASES[bestTag]}`);

  if (c.runtimeFit > 0.85 && settings.weights.runtimeFit > 40) {
    out.push(`${formatRuntime(film.runtime)} is the length you actually finish`);
  }

  // Zero here means "TMDB gave us no count", not "nobody has seen it", so it
  // is not something to claim.
  if (settings.surfaceObscure && film.ratingsK > 0 && film.ratingsK < 120) {
    out.push(`Only ${film.ratingsK}k ratings — off the beaten path`);
  }

  return out.slice(0, 3);
}

export function formatRuntime(min: number): string {
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}

/**
 * Not everything that reaches the film cache is a film. Searching TMDB
 * remembers every result, so a query for a title also drags in its trailers,
 * featurettes and unauthorised making-ofs — and those then competed for a
 * place in the recommendations.
 *
 * Two things disqualify a candidate. Carrying neither a genre nor a tag means
 * there is nothing to compare against a taste profile, so any score would be
 * invented. Running under twenty minutes means it is an extra rather than an
 * evening — La Jetee is 28 minutes and stays, a nine-minute behind-the-scenes
 * reel does not.
 */
const MIN_RUNTIME = 20;

export function isRecommendable(film: Film): boolean {
  if (film.genres.length === 0 && film.tags.length === 0) return false;
  if (!film.runtime || film.runtime < MIN_RUNTIME) return false;
  return true;
}

function passesRules(film: Film, state: AppState, seen: Set<string>, listed: Set<string>): boolean {
  const { settings } = state;
  if (!isRecommendable(film)) return false;
  if (listed.has(film.id)) return false;
  if (state.dismissed.includes(film.id)) return false;
  if (seen.has(film.id)) {
    // Only offer a rewatch once it has had time to become one.
    if (!settings.includeRewatches) return false;
    const last = lastWatched(film, state.log);
    if (last && daysSince(last.watchedOn) < REWATCH_AFTER_DAYS) return false;
  }
  if (settings.runtimeCeiling !== null && film.runtime > settings.runtimeCeiling) return false;
  if (film.genres.some((g) => settings.excludedGenres.includes(g))) return false;
  if (!settings.surfaceObscure && film.ratingsK < 200) return false;
  return true;
}

/**
 * What the person is in the mood for right now, as opposed to the standing
 * settings in Tune My Taste. Nothing here is saved — it steers this visit.
 */
export interface Focus {
  /** Minutes. Nothing longer is offered. */
  maxRuntime?: number | null;
  /** Logged films to pull the ranking toward: "more like these". */
  seedIds?: string[];
  /** A candidate must carry at least one of these. */
  tags?: Tag[];
  /** Restrict to one decade. */
  decade?: number | null;
}

const EMPTY_FOCUS: Focus = {};

export function focusIsActive(f: Focus): boolean {
  return Boolean(f.maxRuntime || f.seedIds?.length || f.tags?.length || f.decade);
}

export function recommend(
  state: AppState,
  catalogue: Film[],
  getFilm: (id: string) => Film | undefined,
  limit = 12,
  focus: Focus = EMPTY_FOCUS,
): Recommendation[] {
  const taste = buildTaste(state.log, getFilm);
  const seen = new Set(state.log.map((e) => e.filmId));
  const listed = new Set(state.watchlist.map((w) => w.filmId));

  const w = state.settings.weights;
  const total = w.people + w.affinity + w.runtimeFit + w.era + w.community || 1;

  const seedFilms = (focus.seedIds ?? [])
    .map((id) => getFilm(id))
    .filter((f): f is Film => Boolean(f));
  const wantTags = new Set(focus.tags ?? []);

  const scored = catalogue
    .filter((f) => passesRules(f, state, seen, listed))
    .filter((f) => {
      if (focus.maxRuntime && f.runtime > focus.maxRuntime) return false;
      if (focus.decade && Math.floor(f.year / 10) * 10 !== focus.decade) return false;
      if (wantTags.size && !f.tags.some((t) => wantTags.has(t))) return false;
      return true;
    })
    .map((film) => {
      const c = components(film, taste);
      let raw =
        (c.people * w.people +
          c.affinity * w.affinity +
          c.runtimeFit * w.runtimeFit +
          c.era * w.era +
          c.community * w.community) /
        total;

      // Pointing at a film is an explicit instruction, so it outweighs the
      // standing profile rather than nudging it.
      const like = seedFilms.length ? seedAffinity(film, seedFilms) : 0;
      if (seedFilms.length) raw = raw * 0.4 + like * 0.6;

      // Spread the top of the range out; raw rarely exceeds 0.8 in practice.
      const match = Math.round(clamp01(raw * 1.12) * 100);
      const reasons = reasonsFor(film, taste, c, state.log, getFilm, state.settings);
      let seedReason: string | undefined;
      if (seedFilms.length && like > 0.3) {
        const nearest = seedFilms.reduce((a, b) =>
          seedAffinity(film, [a]) >= seedAffinity(film, [b]) ? a : b,
        );
        seedReason = `Close to ${nearest.title} on tone and subject`;
      }
      return { film, match, reasons, seedReason };
    });

  // A NaN comparison returns NaN, which sorts as equal — which is how the
  // broken entry came to sit at the top of the list rather than the bottom.
  scored.sort((a, b) => (b.match || 0) - (a.match || 0) || a.film.title.localeCompare(b.film.title));
  return scored.slice(0, limit);
}

export interface SeedCluster {
  seed: Film;
  entry: LogEntry;
  results: Recommendation[];
}

/** Groups recommendations under the logged film that best explains each one. */
export function seedClusters(
  recs: Recommendation[],
  state: AppState,
  getFilm: (id: string) => Film | undefined,
  maxClusters = 3,
): SeedCluster[] {
  const taste = buildTaste(state.log, getFilm);
  const bySeed = new Map<string, SeedCluster>();

  for (const rec of recs) {
    const seed = nearestSeed(rec.film, state.log, getFilm, taste.meanScore);
    if (!seed) continue;
    const cluster = bySeed.get(seed.film.id) ?? { seed: seed.film, entry: seed.entry, results: [] };
    cluster.results.push(rec);
    bySeed.set(seed.film.id, cluster);
  }

  return [...bySeed.values()]
    .filter((c) => c.results.length >= 2)
    .sort((a, b) => b.entry.score - a.entry.score)
    .slice(0, maxClusters)
    .map((c) => ({ ...c, results: c.results.slice(0, 3) }));
}
