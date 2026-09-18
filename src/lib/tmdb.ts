import type { Film, Genre, Tag } from './types';

/**
 * TMDB adapter.
 *
 * ⚠️ UNVERIFIED AGAINST THE LIVE API. The sandbox this was written in blocks
 * egress to api.themoviedb.org, so the request shapes below come from TMDB's
 * documented v3 contract rather than an observed response. Run it locally with
 * a key before trusting it; `probeTmdb()` exists for exactly that.
 *
 * Auth: a v3 API key (`?api_key=`) or a v4 read token (`Authorization: Bearer`).
 * Both are read-only. Whichever you use ends up visible to anyone who opens the
 * site, so use a key you are willing to have public and keep it rate-limited to
 * your own use.
 */

export const TMDB_BASE = 'https://api.themoviedb.org/3';
export const TMDB_IMG = 'https://image.tmdb.org/t/p';

export interface TmdbConfig {
  key: string;
  /** v4 read tokens are JWTs and go in a header; v3 keys go in the query string. */
  kind: 'v3' | 'v4';
}

export function detectKeyKind(key: string): TmdbConfig['kind'] {
  return key.trim().startsWith('ey') && key.includes('.') ? 'v4' : 'v3';
}

function url(path: string, cfg: TmdbConfig, params: Record<string, string | number> = {}) {
  const u = new URL(TMDB_BASE + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  if (cfg.kind === 'v3') u.searchParams.set('api_key', cfg.key);
  return u.toString();
}

async function get<T>(path: string, cfg: TmdbConfig, params?: Record<string, string | number>): Promise<T> {
  const res = await fetch(url(path, cfg, params), {
    headers: cfg.kind === 'v4' ? { Authorization: `Bearer ${cfg.key}` } : {},
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TMDB ${res.status} on ${path}${body ? `: ${body.slice(0, 160)}` : ''}`);
  }
  return (await res.json()) as T;
}

/* ── response shapes (from TMDB's documented v3 contract) ────────────── */

interface TmdbListItem {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
}

interface TmdbMovie extends Omit<TmdbListItem, 'genre_ids'> {
  runtime?: number | null;
  genres?: { id: number; name: string }[];
  production_countries?: { iso_3166_1: string; name: string }[];
  credits?: { crew?: { job?: string; name?: string }[] };
  keywords?: { keywords?: { id: number; name: string }[] };
}

/* ── mapping into our own model ──────────────────────────────────────── */

export const tmdbId = (id: number) => `tmdb:${id}`;
export const isTmdbId = (id: string) => id.startsWith('tmdb:');
export const rawTmdbId = (id: string) => Number(id.slice(5));

/** TMDB genre names we care about, mapped onto ours. Anything else is dropped. */
const GENRE_MAP: Record<string, Genre> = {
  'Science Fiction': 'Sci-fi',
  Drama: 'Drama',
  Thriller: 'Thriller',
  Crime: 'Crime',
  Animation: 'Animation',
  Horror: 'Horror',
  Action: 'Action',
  Mystery: 'Mystery',
  Romance: 'Romance',
  War: 'War',
  Comedy: 'Comedy',
};

/**
 * TMDB has no notion of "slow" or "bleak", so the recommender's editorial tags
 * are derived from TMDB keywords. This mapping is the honest weak point of the
 * integration: it is a hand-written approximation, and films with sparse
 * keywords will come through under-tagged and score lower than they deserve.
 */
const KEYWORD_TAGS: [RegExp, Tag][] = [
  [/dystopia|totalitarian|post-apocalyptic/i, 'dystopia'],
  [/artificial intelligence|robot|android|cyborg/i, 'ai'],
  [/space|astronaut|spacecraft|outer space/i, 'space'],
  [/time travel|time loop|time paradox/i, 'time-loop'],
  [/surveillance|wiretap|espionage|spy/i, 'surveillance'],
  [/memory|amnesia|dream/i, 'memory'],
  [/grief|mourning|loss of loved one|bereavement/i, 'grief'],
  [/body horror|mutation|transformation/i, 'body-horror'],
  [/film noir|neo-noir|private detective/i, 'noir-lighting'],
  [/rain|monsoon/i, 'rain'],
  [/investigation|police procedural|detective|manhunt/i, 'procedural'],
  [/satire|black comedy|social commentary/i, 'satire'],
  [/anime|based on manga/i, 'anime'],
  [/desert|western/i, 'desert'],
  [/one night|single location|confined space|bottle/i, 'one-location'],
  [/twist ending|unreliable narrator/i, 'twist'],
  [/ensemble cast/i, 'ensemble'],
  [/practical effects|stop motion|miniature/i, 'practical-fx'],
  [/philosophy|existentialism|metaphysics/i, 'cerebral'],
  [/slow cinema|meditative|contemplative/i, 'slow'],
  [/arthouse|experimental|avant-garde/i, 'arthouse'],
  [/nihilism|bleak|despair/i, 'bleak'],
  [/city|urban|neon|nightlife/i, 'city-at-night'],
];

function tagsFrom(movie: TmdbMovie): Tag[] {
  const names = (movie.keywords?.keywords ?? []).map((k) => k.name).join(' | ');
  const out = new Set<Tag>();
  for (const [re, tag] of KEYWORD_TAGS) if (re.test(names)) out.add(tag);

  // A couple of tags are better inferred from structured fields than keywords.
  const genres = (movie.genres ?? []).map((g) => g.name);
  if (genres.includes('Animation')) out.add('anime');
  if ((movie.runtime ?? 0) >= 150) out.add('slow');
  if ((movie.vote_count ?? 0) > 5000) out.add('blockbuster');

  return [...out];
}

export function toFilm(movie: TmdbMovie): Film {
  const year = Number((movie.release_date ?? '').slice(0, 4)) || 0;
  const director =
    movie.credits?.crew?.find((c) => c.job === 'Director')?.name ?? 'Unknown';
  const votes = movie.vote_count ?? 0;

  return {
    id: tmdbId(movie.id),
    title: movie.title,
    year,
    runtime: movie.runtime ?? 0,
    director,
    country: movie.production_countries?.[0]?.iso_3166_1 ?? '—',
    genres: (movie.genres ?? [])
      .map((g) => GENRE_MAP[g.name])
      .filter((g): g is Genre => Boolean(g)),
    tags: tagsFrom(movie),
    acclaim: Math.round((movie.vote_average ?? 0) * 10),
    ratingsK: Math.round(votes / 1000),
    // Deterministic, so a given film always gets the same fallback treatment.
    art: movie.id % 8,
    synopsis: movie.overview?.trim() || 'No synopsis on file.',
    posterPath: movie.poster_path ?? undefined,
  };
}

export function posterUrl(path: string | undefined, size: 'w342' | 'w500' | 'w780' = 'w500') {
  return path ? `${TMDB_IMG}/${size}${path}` : undefined;
}

/* ── calls ───────────────────────────────────────────────────────────── */

/** Full details, including the credits and keywords the mapping needs. */
export async function fetchFilm(id: number, cfg: TmdbConfig): Promise<Film> {
  const movie = await get<TmdbMovie>(`/movie/${id}`, cfg, { append_to_response: 'credits,keywords' });
  return toFilm(movie);
}

/**
 * Search returns list items, which carry no runtime, director or keywords —
 * so results are hydrated one by one. Capped, because that is one request per
 * result against a rate-limited API.
 */
export async function searchFilms(query: string, cfg: TmdbConfig, limit = 8): Promise<Film[]> {
  const list = await get<{ results: TmdbListItem[] }>('/search/movie', cfg, {
    query,
    include_adult: 'false',
  });
  const top = list.results.slice(0, limit);
  const settled = await Promise.allSettled(top.map((r) => fetchFilm(r.id, cfg)));
  return settled
    .filter((s): s is PromiseFulfilledResult<Film> => s.status === 'fulfilled')
    .map((s) => s.value);
}

/**
 * Cheap poster lookup for a film we already have metadata for: one search
 * request, no detail fetch. Used to give the bundled catalogue real artwork
 * without replacing its hand-written tags.
 */
export async function findPoster(
  title: string,
  year: number,
  cfg: TmdbConfig,
): Promise<{ posterPath?: string; tmdbId?: number } | null> {
  const list = await get<{ results: TmdbListItem[] }>('/search/movie', cfg, {
    query: title,
    include_adult: 'false',
    ...(year ? { year } : {}),
  });

  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const target = norm(title);

  // Prefer an exact title match; fall back to the first result TMDB ranked.
  const exact = list.results.find((r) => norm(r.title) === target);
  const best = exact ?? list.results[0];
  if (!best) return null;
  return { posterPath: best.poster_path ?? undefined, tmdbId: best.id };
}

export interface DiscoverOptions {
  genreIds?: number[];
  decade?: number;
  minVotes?: number;
  page?: number;
  sortBy?: string;
}

/** Candidate pool for the recommender — the engine cannot score 800k films. */
export async function discoverFilms(cfg: TmdbConfig, opts: DiscoverOptions = {}, limit = 20): Promise<Film[]> {
  const params: Record<string, string | number> = {
    include_adult: 'false',
    'vote_count.gte': opts.minVotes ?? 500,
    sort_by: opts.sortBy ?? 'vote_average.desc',
    page: opts.page ?? 1,
  };
  if (opts.genreIds?.length) params.with_genres = opts.genreIds.join(',');
  if (opts.decade) {
    params['primary_release_date.gte'] = `${opts.decade}-01-01`;
    params['primary_release_date.lte'] = `${opts.decade + 9}-12-31`;
  }
  const list = await get<{ results: TmdbListItem[] }>('/discover/movie', cfg, params);
  const settled = await Promise.allSettled(list.results.slice(0, limit).map((r) => fetchFilm(r.id, cfg)));
  return settled
    .filter((s): s is PromiseFulfilledResult<Film> => s.status === 'fulfilled')
    .map((s) => s.value);
}

/** Our genres back to TMDB's ids, for discover queries. */
export const TMDB_GENRE_IDS: Partial<Record<Genre, number>> = {
  'Sci-fi': 878,
  Drama: 18,
  Thriller: 53,
  Crime: 80,
  Animation: 16,
  Horror: 27,
  Action: 28,
  Mystery: 9648,
  Romance: 10749,
  War: 10752,
  Comedy: 35,
};

export interface Probe {
  ok: boolean;
  message: string;
  sample?: string;
}

/** Round-trips one known film so a key can be checked from the Settings screen. */
export async function probeTmdb(cfg: TmdbConfig): Promise<Probe> {
  try {
    const film = await fetchFilm(550, cfg); // Fight Club — stable, always present
    return {
      ok: true,
      message: `Connected. Mapped ${film.title} (${film.year}), ${film.runtime} min, dir. ${film.director}.`,
      sample: `${film.genres.join(', ') || 'no genres mapped'} · ${film.tags.length} tags derived`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Unknown error' };
  }
}
