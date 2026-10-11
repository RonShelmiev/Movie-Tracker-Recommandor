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
  /**
   * The films you rated above your own average, with how far above. Tag
   * averages lose what a film *is*: "slow" and "space" both score well
   * separately without ever saying that slow space films are the point.
   * Comparing a candidate against whole films you loved keeps that.
   */
  favourites: { film: Film; weight: number }[];
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
  favourites: [],
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

  // Everything you liked more than your own average, best first. Capped: a
  // long tail of barely-above-average films would drown the real signal.
  const favourites = rated
    .filter((x) => x.e.score > meanScore)
    .map((x) => ({ film: x.f, weight: x.e.score - meanScore }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 12);

  return {
    n: rated.length,
    meanScore,
    tag: normalise(tag),
    genre: normalise(genre),
    director,
    runtimeMean,
    runtimeSd: Math.max(20, Math.sqrt(variance)),
    decade: normalise(decade),
    favourites,
  };
}

/** 0..1 for each axis, before the user's weights are applied. */
export interface Components {
  people: number;
  affinity: number;
  similarity: number;
  runtimeFit: number;
  era: number;
  community: number;
}

/**
 * How much two films are the same kind of thing, 0..1. Jaccard over tags and
 * genres: shared features over the union, so it is not fooled by one film
 * simply carrying more tags than the other.
 */
function kinship(a: Film, b: Film): number {
  const A = new Set<string>([...a.tags, ...a.genres]);
  const B = new Set<string>([...b.tags, ...b.genres]);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const x of A) if (B.has(x)) shared += 1;
  return shared / (A.size + B.size - shared);
}

function components(film: Film, taste: Taste): Components {
  /* ── people ──
     Was a flat 0.35 for any director you had not rated, which is most of
     them: the heaviest-weighted axis had eight distinct values across the
     whole catalogue and mostly said "stranger". Unknown is now genuinely
     neutral, and a verdict you have actually earned moves it — further the
     more films it rests on, because one rating is a rumour and four are a
     pattern. */
  const dir = taste.director.get(film.director);
  const people = dir
    ? clamp01(0.5 + ((dir.mean - taste.meanScore) / 3) * Math.min(1, Math.sqrt(dir.n) / 2))
    : 0.5;

  /* ── affinity ──
     Was the mean weight over every tag a film carries, so a film with three
     tags you love and five you have no opinion on scored below a thin film
     with one. Strong hits now carry most of it and breadth the rest, and the
     output uses the range instead of hugging 0.5. */
  const weights: number[] = [];
  for (const t of film.tags) weights.push(taste.tag.get(t) ?? 0);
  for (const g of film.genres) weights.push((taste.genre.get(g) ?? 0) * 1.2);
  let affinity = 0.5;
  if (weights.length) {
    const sorted = [...weights].sort((a, b) => b - a);
    const top = sorted.slice(0, 3);
    const strong = top.reduce((s, v) => s + v, 0) / top.length;
    const breadth = weights.reduce((s, v) => s + v, 0) / weights.length;
    affinity = clamp01(0.5 + (strong * 0.7 + breadth * 0.3) * 0.72);
  }

  /* ── similarity ──
     New. Averages of tags cannot express a combination: "slow" and "space"
     score well one at a time without ever saying that slow space films are
     the thing. This asks the direct question instead — how close is this to
     the films you actually rated highest. */
  let similarity = 0.5;
  if (taste.favourites.length) {
    let acc = 0;
    let wsum = 0;
    for (const fav of taste.favourites) {
      if (fav.film.id === film.id) continue;
      acc += kinship(film, fav.film) * fav.weight;
      wsum += fav.weight;
    }
    // Jaccard between two films of the same kind lands around 0.3-0.5, so the
    // raw mean never approaches 1. Scaled to use the range.
    similarity = wsum ? clamp01((acc / wsum) * 2.2) : 0.5;
  }

  const z = (film.runtime - taste.runtimeMean) / taste.runtimeSd;
  const runtimeFit = Math.exp(-(z * z) / 2);

  const dec = Math.floor(film.year / 10) * 10;
  const era = clamp01(0.5 + (taste.decade.get(dec) ?? 0) / 2);

  const community = film.acclaim / 100;

  return { people, affinity, similarity, runtimeFit, era, community };
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
  const self = new Set(keysOf(film));
  for (const entry of log) {
    if (entry.filmId === film.id) continue; // a film cannot be its own reason
    const seed = getFilm(entry.filmId);
    if (!seed || entry.score < meanScore) continue;
    if (self.has(filmKey(seed))) continue; // nor can its other copy
    const s = overlap(film, seed) * (1 + (entry.score - meanScore) / 5);
    if (s > bestScore) {
      bestScore = s;
      best = { film: seed, entry };
    }
  }
  return bestScore >= 2 ? best : null;
}

/**
 * One film can sit in the cache under two ids: the bundled `collateral` and
 * the `tmdb:1538` that a search brought back. Logging one left the other
 * looking unseen, and it was then recommended. Title and year identify a film
 * across both sources; accents and punctuation differ between them, so they
 * are stripped.
 */
export function filmKey(f: Pick<Film, 'title' | 'year'>): string {
  const title = f.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${title}|${f.year}`;
}

/** Release years drift by one between sources (festival vs. general release). */
function keysOf(f: Film): string[] {
  return [filmKey(f), filmKey({ title: f.title, year: f.year - 1 }), filmKey({ title: f.title, year: f.year + 1 })];
}

const REWATCH_AFTER_DAYS = 180;

/** The most recent log entry for each film, under every id it goes by. */
function lastWatchedIndex(log: LogEntry[], getFilm: (id: string) => Film | undefined): Map<string, LogEntry> {
  const out = new Map<string, LogEntry>();
  const put = (k: string, e: LogEntry) => {
    const prev = out.get(k);
    if (!prev || e.watchedOn > prev.watchedOn) out.set(k, e);
  };
  for (const e of log) {
    put(e.filmId, e);
    const f = getFilm(e.filmId);
    if (f) put(filmKey(f), e);
  }
  return out;
}

function lastWatched(film: Film, index: Map<string, LogEntry>): LogEntry | null {
  return index.get(film.id) ?? keysOf(film).map((k) => index.get(k)).find(Boolean) ?? null;
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
  watched: Map<string, LogEntry>,
): string[] {
  const out: string[] = [];

  const own = lastWatched(film, watched);
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

interface RuleContext {
  watched: Map<string, LogEntry>;
  /** Ids and title keys of everything on the list or dismissed. */
  blocked: Set<string>;
  meanScore: number;
}

/**
 * A rewatch is offered only when asked for, only once it has had time to
 * become one, and only for a film you liked. Before, any film logged with a
 * date over six months back came straight back as a suggestion — so
 * backfilling a history filled the picks with films already seen, including
 * ones rated badly.
 */
function isRewatchWorthy(last: LogEntry, meanScore: number) {
  return daysSince(last.watchedOn) >= REWATCH_AFTER_DAYS && last.score >= Math.max(7.5, meanScore + 0.5);
}

function passesRules(film: Film, state: AppState, ctx: RuleContext): boolean {
  const { settings } = state;
  if (!isRecommendable(film)) return false;
  if (ctx.blocked.has(film.id) || keysOf(film).some((k) => ctx.blocked.has(k))) return false;
  const last = lastWatched(film, ctx.watched);
  if (last && !(settings.offerRewatches && isRewatchWorthy(last, ctx.meanScore))) return false;
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

/**
 * Below this many logged films the profile is mostly noise, and a match
 * percentage would be a confident-looking number with nothing behind it.
 */
const MIN_LOG_FOR_MATCH = 3;

export const matchIsMeaningful = (taste: Taste) => taste.n >= MIN_LOG_FOR_MATCH;

/** The weighted sum, 0..1, for a film already known to be scoreable. */
function rawScore(c: Components, settings: Settings): number {
  const w = settings.weights;
  const sim = w.similarity ?? 0;
  const total = w.people + w.affinity + sim + w.runtimeFit + w.era + w.community || 1;
  return (
    (c.people * w.people +
      c.affinity * w.affinity +
      c.similarity * sim +
      c.runtimeFit * w.runtimeFit +
      c.era * w.era +
      c.community * w.community) /
    total
  );
}

/**
 * Raw sits around 0.3-0.85 now the axes use their range, so a light
 * expansion puts a very strong match near the top without a crowd of films
 * pinned at 100 — which would also throw away the ordering between them.
 */
const toMatch = (raw: number) => Math.round(clamp01(raw * 1.06) * 100);

export interface Score {
  match: number;
  components: Components;
  reasons: string[];
}

/**
 * One film against the profile, with the hard rules left out — those decide
 * what to *offer*, which is a different question from how well something
 * fits. A film already seen, already listed or over the runtime ceiling
 * still has an honest answer to "would I like this".
 *
 * Shared with `recommend` on purpose: a percentage shown on a poster that
 * disagreed with the one on the For You card would be worse than no
 * percentage at all.
 */
export function scoreFilm(
  state: AppState,
  film: Film,
  getFilm: (id: string) => Film | undefined,
  ctx: MatchContext = matchContext(state, getFilm),
): Score | null {
  if (!isRecommendable(film) || !matchIsMeaningful(ctx.taste)) return null;
  const components_ = components(film, ctx.taste);
  return {
    match: toMatch(rawScore(components_, state.settings)),
    components: components_,
    reasons: reasonsFor(film, ctx.taste, components_, state.log, getFilm, state.settings, ctx.watched),
  };
}

/**
 * The per-library work `scoreFilm` would otherwise repeat. A grid scoring
 * eighty-nine posters should build the profile and the watched index once,
 * not once per poster.
 */
export interface MatchContext {
  taste: Taste;
  watched: Map<string, LogEntry>;
}

export function matchContext(
  state: AppState,
  getFilm: (id: string) => Film | undefined,
): MatchContext {
  return {
    taste: buildTaste(state.log, getFilm),
    watched: lastWatchedIndex(state.log, getFilm),
  };
}

export function recommend(
  state: AppState,
  catalogue: Film[],
  getFilm: (id: string) => Film | undefined,
  limit = 12,
  focus: Focus = EMPTY_FOCUS,
): Recommendation[] {
  const taste = buildTaste(state.log, getFilm);
  const watched = lastWatchedIndex(state.log, getFilm);
  const blocked = new Set<string>();
  for (const id of [...state.watchlist.map((w) => w.filmId), ...state.dismissed]) {
    blocked.add(id);
    const f = getFilm(id);
    if (f) blocked.add(filmKey(f));
  }
  const ctx: RuleContext = { watched, blocked, meanScore: taste.meanScore };

  // Two copies of one film would otherwise both be ranked. Keep the bundled
  // one: its tags are written by hand.
  const unique = new Map<string, Film>();
  for (const f of catalogue) {
    const k = filmKey(f);
    const prev = unique.get(k);
    if (!prev || (prev.id.startsWith('tmdb:') && !f.id.startsWith('tmdb:'))) unique.set(k, f);
  }

  const seedFilms = (focus.seedIds ?? [])
    .map((id) => getFilm(id))
    .filter((f): f is Film => Boolean(f));
  const wantTags = new Set(focus.tags ?? []);

  const scored = [...unique.values()]
    .filter((f) => passesRules(f, state, ctx))
    .filter((f) => {
      if (focus.maxRuntime && f.runtime > focus.maxRuntime) return false;
      if (focus.decade && Math.floor(f.year / 10) * 10 !== focus.decade) return false;
      if (wantTags.size && !f.tags.some((t) => wantTags.has(t))) return false;
      return true;
    })
    .map((film) => {
      const c = components(film, taste);
      let raw = rawScore(c, state.settings);

      // Pointing at a film is an explicit instruction, so it outweighs the
      // standing profile rather than nudging it.
      const like = seedFilms.length ? seedAffinity(film, seedFilms) : 0;
      if (seedFilms.length) raw = raw * 0.4 + like * 0.6;

      const match = toMatch(raw);
      const reasons = reasonsFor(film, taste, c, state.log, getFilm, state.settings, watched);
      let seedReason: string | undefined;
      if (seedFilms.length && like > 0.3) {
        const nearest = seedFilms.reduce((a, b) =>
          seedAffinity(film, [a]) >= seedAffinity(film, [b]) ? a : b,
        );
        seedReason = `Close to ${nearest.title} on tone and subject`;
      }
      return { film, match, raw, reasons, seedReason, rewatch: Boolean(lastWatched(film, watched)) };
    });

  // On the unrounded score: two films both shown as 91% are not really equal,
  // and falling back to the alphabet at the top of the list is arbitrary.
  // A NaN comparison returns NaN, which sorts as equal — which is how a
  // broken entry once came to sit at the top rather than the bottom.
  scored.sort((a, b) => (b.raw || 0) - (a.raw || 0) || a.film.title.localeCompare(b.film.title));

  // These are suggestions for something new. A film you loved always matches
  // your own taste best, so left alone rewatches would take the top of every
  // list. They get one place per eight picks, never in the top three.
  const TOP_FOR_NEW = 3;
  const rewatchesLeft = Math.max(1, Math.floor(limit / 8));
  const fresh = scored.filter((r) => !r.rewatch);
  const again = scored.filter((r) => r.rewatch).slice(0, rewatchesLeft);
  const out: Recommendation[] = [];
  let i = 0;
  let j = 0;
  while (out.length < limit && (i < fresh.length || j < again.length)) {
    const takeAgain =
      j < again.length &&
      out.length >= Math.min(TOP_FOR_NEW, fresh.length) &&
      (i >= fresh.length || (again[j].raw || 0) >= (fresh[i].raw || 0));
    const { rewatch: _rewatch, raw: _raw, ...rec } = takeAgain ? again[j++] : fresh[i++];
    out.push(rec);
  }
  return out;
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
