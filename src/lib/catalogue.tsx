import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CATALOGUE } from '../data/catalogue';
import * as tmdb from './tmdb';
import { filmKey } from './recommend';
import type { Film, Genre } from './types';

/** Lookups per batch, and the gap between batches — TMDB is rate-limited. */
const BATCH = 5;
const PACE = 120;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CACHE_KEY = 'flick.films.v1';
const KEY_KEY = 'flick.tmdb.v1';
const POSTER_KEY = 'flick.posters.v1';
const LINKS_KEY = 'flick.links.v1';
const GROWN_KEY = 'flick.grown.v1';
const TMDB_IDS_KEY = 'flick.tmdbids.v1';
const TRAILERS_KEY = 'flick.trailers.v1';

/** How long one favourite's TMDB neighbours are trusted before asking again. */
const REGROW_DAYS = 14;
/** Favourites asked about per run, and new films fetched per run at most. */
const GROW_SEEDS = 8;
const GROW_FETCH_CAP = 60;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* over quota — the links are rebuilt next time the pool grows */
  }
}

/**
 * Posters found for bundled films, kept separately from the film cache: the
 * bundled metadata ships with the app, so only the artwork needs persisting.
 *
 * A key is only ever written for an answer TMDB actually gave: a path when it
 * has artwork, `""` when it genuinely has none. A *failed request* is left
 * unrecorded, so the next load asks again. Recording failures here used to
 * mean one rate-limited moment mid-backfill blanked most of the catalogue
 * for good, with no way back short of clearing site data.
 */
function loadPosters(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(POSTER_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function persistPosters(map: Record<string, string>) {
  try {
    localStorage.setItem(POSTER_KEY, JSON.stringify(map));
  } catch {
    /* over quota — posters just re-resolve next session */
  }
}

/**
 * Every film the user has ever touched is cached locally. This is not an
 * optimisation — the log stores ids, and stats and recommendations need the
 * metadata synchronously and offline. Without the cache, logging a film from
 * TMDB and then going offline would leave holes in your own history.
 */
function loadCache(): Map<string, Film> {
  const m = new Map<string, Film>();
  const posters = loadPosters();
  for (const f of CATALOGUE) {
    const p = posters[f.id];
    m.set(f.id, p ? { ...f, posterPath: p } : f);
  }
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) for (const f of JSON.parse(raw) as Film[]) m.set(f.id, f);
  } catch {
    // Corrupt or unavailable storage just means we fall back to the bundled set.
  }
  // Kept apart from the cache because bundled films are never persisted there.
  const links = readJson<Record<string, string[]>>(LINKS_KEY, {});
  for (const [id, from] of Object.entries(links)) {
    const f = m.get(id);
    if (f) m.set(id, { ...f, linkedFrom: from });
  }
  return m;
}

function persistCache(m: Map<string, Film>) {
  try {
    // Only remote films need persisting; the bundled ones ship with the app.
    const remote = [...m.values()].filter((f) => tmdb.isTmdbId(f.id));
    localStorage.setItem(CACHE_KEY, JSON.stringify(remote));
  } catch {
    // Over quota — the session still works, it just will not survive a reload.
  }
}

function loadKey(): string {
  try {
    return localStorage.getItem(KEY_KEY) ?? (import.meta.env.VITE_TMDB_KEY as string | undefined) ?? '';
  } catch {
    return (import.meta.env.VITE_TMDB_KEY as string | undefined) ?? '';
  }
}

export interface CatalogueApi {
  mode: 'bundled' | 'tmdb';
  /** Synchronous lookup across the bundled set and everything cached. */
  getFilm: (id: string) => Film | undefined;
  /** Everything available to score locally. */
  candidates: Film[];
  /** The bundled set only — what Browse can page through without a network. */
  bundled: Film[];
  search: (query: string) => Promise<Film[]>;
  /** Progress of the poster backfill for the bundled catalogue. */
  hydrating: { done: number; total: number } | null;
  hydratePosters: () => Promise<void>;
  /** How much of the bundled catalogue has artwork, for the Settings readout. */
  posterStats: { found: number; total: number };
  /** Pull a candidate pool matching the user's strongest genres. */
  expandPool: (genres: Genre[], decade?: number) => Promise<number>;
  /**
   * Widen the pool with what TMDB recommends alongside your favourites. Safe
   * to call on every visit: each favourite is only asked about once a fortnight.
   */
  growFrom: (favourites: Film[]) => Promise<void>;
  /** Progress of a running growFrom, for a quiet "finding more" line. */
  growing: { done: number; total: number } | null;
  /**
   * The film's YouTube trailer key. Null when TMDB lists none, and undefined
   * when it could not be asked — no key, offline — so the page can tell
   * "there is no trailer" from "we could not look".
   */
  trailerFor: (film: Film) => Promise<string | null | undefined>;
  remember: (films: Film[]) => void;
  /**
   * Fetch one TMDB film that is not cached yet — a shared link, or a device
   * that never searched for it. Resolves undefined when there is no key, the
   * id is not a TMDB one, or TMDB could not be reached.
   */
  load: (id: string) => Promise<Film | undefined>;
  tmdbKey: string;
  setTmdbKey: (key: string) => void;
  /** Check a key. Pass the one being typed — waiting for it to land in state
   *  is what used to make a good key report "No key set." */
  probe: (keyOverride?: string) => Promise<tmdb.Probe>;
  busy: boolean;
  lastError: string | null;
}

const Ctx = createContext<CatalogueApi | null>(null);

export function CatalogueProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<Map<string, Film>>(loadCache());
  const [version, setVersion] = useState(0);
  const [tmdbKey, setKeyState] = useState<string>(loadKey);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState<{ done: number; total: number } | null>(null);
  const runningRef = useRef(false);
  const growingRef = useRef(false);
  const [growing, setGrowing] = useState<{ done: number; total: number } | null>(null);

  const cfg = useMemo<tmdb.TmdbConfig | null>(
    () => (tmdbKey.trim() ? { key: tmdbKey.trim(), kind: tmdb.detectKeyKind(tmdbKey) } : null),
    [tmdbKey],
  );

  const remember = useCallback((films: Film[]) => {
    if (!films.length) return;
    for (const f of films) cacheRef.current.set(f.id, f);
    persistCache(cacheRef.current);
    setVersion((v) => v + 1);
  }, []);

  const getFilm = useCallback((id: string) => cacheRef.current.get(id), []);

  const load = useCallback(
    async (id: string): Promise<Film | undefined> => {
      const cached = cacheRef.current.get(id);
      if (cached || !cfg || !tmdb.isTmdbId(id)) return cached;
      try {
        const film = await tmdb.fetchFilm(tmdb.rawTmdbId(id), cfg);
        remember([film]);
        return film;
      } catch {
        return undefined;
      }
    },
    [cfg, remember],
  );

  const candidates = useMemo(
    () => [...cacheRef.current.values()],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const search = useCallback(
    async (query: string): Promise<Film[]> => {
      const q = query.trim().toLowerCase();
      if (!q) return [];

      const local = [...cacheRef.current.values()].filter(
        (f) => f.title.toLowerCase().includes(q) || f.director.toLowerCase().includes(q),
      );
      if (!cfg) return local;

      setBusy(true);
      setLastError(null);
      try {
        const found = await tmdb.searchFilms(query, cfg);
        // A TMDB hit for a film the bundled catalogue already has is the same
        // film. Hand back the bundled copy, so a log lands on one id and the
        // recommender does not see the other as unwatched.
        const bundledByKey = new Map(CATALOGUE.map((f) => [filmKey(f), f] as const));
        const remote = found.map((f) => {
          const b = bundledByKey.get(filmKey(f));
          return b ? cacheRef.current.get(b.id) ?? b : f;
        });
        remember(remote.filter((f) => tmdb.isTmdbId(f.id)));
        // Local hits first — they are the ones you have a history with.
        const seen = new Set(local.map((f) => f.id));
        return [...local, ...remote.filter((f, i, all) => !seen.has(f.id) && all.findIndex((g) => g.id === f.id) === i)];
      } catch (e) {
        setLastError(e instanceof Error ? e.message : 'Search failed');
        return local;
      } finally {
        setBusy(false);
      }
    },
    [cfg, remember],
  );

  const expandPool = useCallback(
    async (genres: Genre[], decade?: number): Promise<number> => {
      if (!cfg) return 0;
      setBusy(true);
      setLastError(null);
      try {
        const genreIds = genres
          .map((g) => tmdb.TMDB_GENRE_IDS[g])
          .filter((n): n is number => typeof n === 'number');
        const films = await tmdb.discoverFilms(cfg, { genreIds, decade });
        remember(films);
        return films.length;
      } catch (e) {
        setLastError(e instanceof Error ? e.message : 'Could not reach TMDB');
        return 0;
      } finally {
        setBusy(false);
      }
    },
    [cfg, remember],
  );

  const growFrom = useCallback(
    async (favourites: Film[]) => {
      if (!cfg || growingRef.current) return;
      const grown = readJson<Record<string, string>>(GROWN_KEY, {});
      const stale = favourites
        .filter((f) => {
          const at = grown[f.id];
          return !at || Date.now() - new Date(at).getTime() > REGROW_DAYS * 86_400_000;
        })
        .slice(0, GROW_SEEDS);
      if (!stale.length) return;

      growingRef.current = true;
      try {
        const ids = readJson<Record<string, number>>(TMDB_IDS_KEY, {});
        const links = readJson<Record<string, string[]>>(LINKS_KEY, {});
        const bundledByKey = new Map(CATALOGUE.map((f) => [filmKey(f), f.id] as const));
        /** TMDB id -> the favourites that pointed at it. */
        const pointed = new Map<number, Set<string>>();

        // 1. Ask TMDB what goes with each favourite.
        for (const seed of stale) {
          try {
            let id = tmdb.isTmdbId(seed.id) ? tmdb.rawTmdbId(seed.id) : ids[seed.id];
            if (!id && seed.imdb) {
              id = (await tmdb.findByImdb(seed.imdb.id, cfg)) ?? 0;
              if (id) ids[seed.id] = id;
            }
            if (!id) continue;
            for (const r of await tmdb.recommendedWith(id, cfg)) {
              const set = pointed.get(r) ?? new Set<string>();
              set.add(seed.id);
              pointed.set(r, set);
            }
            grown[seed.id] = new Date().toISOString();
          } catch {
            // Unanswered favourites stay stale and are asked about next visit.
          }
        }
        writeJson(TMDB_IDS_KEY, ids);

        // 2. Fetch the ones not already known, most-pointed-at first.
        const unknown = [...pointed.entries()]
          .filter(([id]) => !cacheRef.current.has(tmdb.tmdbId(id)))
          .sort((a, b) => b[1].size - a[1].size)
          .slice(0, GROW_FETCH_CAP)
          .map(([id]) => id);
        setGrowing({ done: 0, total: unknown.length });
        const fetched: Film[] = [];
        for (let i = 0; i < unknown.length; i += BATCH) {
          const settled = await Promise.allSettled(unknown.slice(i, i + BATCH).map((id) => tmdb.fetchFilm(id, cfg)));
          for (const r of settled) if (r.status === 'fulfilled') fetched.push(r.value);
          setGrowing({ done: Math.min(unknown.length, i + BATCH), total: unknown.length });
          if (i + BATCH < unknown.length) await pause(PACE);
        }

        // 3. Record who pointed at what. A film the bundled catalogue already
        //    has is linked under its bundled id, so there is one copy of it.
        const idFor = (tmdbNum: number) => {
          const f = cacheRef.current.get(tmdb.tmdbId(tmdbNum)) ?? fetched.find((x) => x.id === tmdb.tmdbId(tmdbNum));
          return f ? bundledByKey.get(filmKey(f)) ?? f.id : null;
        };
        for (const [tmdbNum, from] of pointed) {
          const id = idFor(tmdbNum);
          if (!id) continue;
          links[id] = [...new Set([...(links[id] ?? []), ...from])];
        }
        writeJson(LINKS_KEY, links);
        writeJson(GROWN_KEY, grown);

        const withLinks = (f: Film) => (links[f.id] ? { ...f, linkedFrom: links[f.id] } : f);
        // New films that are not copies of a bundled one join the pool.
        for (const f of fetched) if (!bundledByKey.has(filmKey(f))) cacheRef.current.set(f.id, withLinks(f));
        for (const id of Object.keys(links)) {
          const f = cacheRef.current.get(id);
          if (f) cacheRef.current.set(id, withLinks(f));
        }
        persistCache(cacheRef.current);
        setVersion((v) => v + 1);
      } finally {
        growingRef.current = false;
        setGrowing(null);
      }
    },
    [cfg],
  );

  const trailerFor = useCallback(
    async (film: Film): Promise<string | null | undefined> => {
      // "" is a settled "TMDB has no trailer"; a failed request is not recorded.
      const known = readJson<Record<string, string>>(TRAILERS_KEY, {});
      if (film.id in known) return known[film.id] || null;
      if (!cfg) return undefined;
      try {
        const ids = readJson<Record<string, number>>(TMDB_IDS_KEY, {});
        let id = tmdb.isTmdbId(film.id) ? tmdb.rawTmdbId(film.id) : ids[film.id];
        if (!id && film.imdb) {
          id = (await tmdb.findByImdb(film.imdb.id, cfg)) ?? 0;
          if (id) writeJson(TMDB_IDS_KEY, { ...ids, [film.id]: id });
        }
        if (!id) return null;
        const key = await tmdb.trailerFor(id, cfg);
        writeJson(TRAILERS_KEY, { ...readJson<Record<string, string>>(TRAILERS_KEY, {}), [film.id]: key ?? '' });
        return key;
      } catch {
        return undefined;
      }
    },
    [cfg],
  );

  /**
   * Give the bundled films real artwork. One search per film, in small batches
   * with a breather between them so a cold start does not fire 89 requests at
   * TMDB's rate limiter all at once.
   *
   * Anything that fails is simply not recorded, which leaves it in `todo` for
   * the next run — the effect below re-runs on every load until the catalogue
   * is complete, so a flaky moment costs a reload rather than the artwork.
   */
  const hydratePosters = useCallback(async () => {
    if (!cfg || runningRef.current) return;
    runningRef.current = true;
    try {
      const posters = loadPosters();
      // Films that ship with a poster need no lookup.
      const todo = CATALOGUE.filter((f) => !f.posterPath && posters[f.id] === undefined);
      if (todo.length === 0) return;

      setHydrating({ done: 0, total: todo.length });
      let done = 0;
      let backoff = 0;

      for (let i = 0; i < todo.length; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map((f) => tmdb.findPoster(f.title, f.year, cfg)),
        );

        let throttled = false;
        results.forEach((r, j) => {
          const film = batch[j];
          if (r.status === 'rejected') {
            // No answer came back. Leave the slot empty so it is retried.
            if (r.reason instanceof tmdb.TmdbError && (r.reason.status === 429 || r.reason.status === 0)) {
              throttled = true;
            }
            return;
          }
          // "" means TMDB answered and has no artwork — settled, never re-ask.
          const path = r.value?.posterPath ?? '';
          posters[film.id] = path;
          if (path) cacheRef.current.set(film.id, { ...film, posterPath: path });
        });

        done += batch.length;
        persistPosters(posters);
        setHydrating({ done, total: todo.length });
        setVersion((v) => v + 1);

        // Ease off when TMDB pushes back, rather than burning the whole run
        // against a closed door.
        backoff = throttled ? Math.min(backoff ? backoff * 2 : 1000, 8000) : 0;
        if (backoff) await pause(backoff);
        else if (i + BATCH < todo.length) await pause(PACE);
      }

      setHydrating(null);
    } finally {
      runningRef.current = false;
    }
  }, [cfg]);

  /**
   * Kick the backfill off whenever a key is present and anything is still
   * outstanding. Unlike a run-once guard, this picks up where a failed run
   * left off on the next visit.
   */
  useEffect(() => {
    if (!cfg) return;
    void hydratePosters();
  }, [cfg, hydratePosters]);

  const setTmdbKey = useCallback((key: string) => {
    try {
      if (key.trim()) localStorage.setItem(KEY_KEY, key.trim());
      else localStorage.removeItem(KEY_KEY);
    } catch {
      // Not persisted, but usable for this session.
    }
    setKeyState(key.trim());
  }, []);

  const probe = useCallback(
    async (keyOverride?: string) => {
      // Tested against the key as typed, not as stored: a React state update
      // has not landed yet when the button's own handler calls this, so
      // reading `cfg` here reported "No key set." for a perfectly good key.
      const raw = (keyOverride ?? tmdbKey).trim();
      if (!raw) return { ok: false, message: 'No key set.' };
      setBusy(true);
      try {
        return await tmdb.probeTmdb({ key: raw, kind: tmdb.detectKeyKind(raw) });
      } finally {
        setBusy(false);
      }
    },
    [tmdbKey],
  );

  useEffect(() => {
    persistCache(cacheRef.current);
  }, []);

  const posterStats = useMemo(
    () => ({
      found: CATALOGUE.filter((f) => cacheRef.current.get(f.id)?.posterPath).length,
      total: CATALOGUE.length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const value = useMemo<CatalogueApi>(
    () => ({
      mode: cfg ? 'tmdb' : 'bundled',
      getFilm,
      candidates,
      bundled: CATALOGUE,
      search,
      hydrating,
      hydratePosters,
      posterStats,
      expandPool,
      growFrom,
      growing,
      trailerFor,
      remember,
      load,
      tmdbKey,
      setTmdbKey,
      probe,
      busy,
      lastError,
    }),
    [cfg, getFilm, candidates, search, hydrating, hydratePosters, posterStats, expandPool, growFrom, growing, trailerFor, remember, load, tmdbKey, setTmdbKey, probe, busy, lastError],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalogue(): CatalogueApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCatalogue must be used inside CatalogueProvider');
  return ctx;
}
