import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CATALOGUE } from '../data/catalogue';
import * as tmdb from './tmdb';
import type { Film, Genre } from './types';

const CACHE_KEY = 'flick.films.v1';
const KEY_KEY = 'flick.tmdb.v1';

/**
 * Every film the user has ever touched is cached locally. This is not an
 * optimisation — the log stores ids, and stats and recommendations need the
 * metadata synchronously and offline. Without the cache, logging a film from
 * TMDB and then going offline would leave holes in your own history.
 */
function loadCache(): Map<string, Film> {
  const m = new Map<string, Film>();
  for (const f of CATALOGUE) m.set(f.id, f);
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) for (const f of JSON.parse(raw) as Film[]) m.set(f.id, f);
  } catch {
    // Corrupt or unavailable storage just means we fall back to the bundled set.
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
  /** Pull a candidate pool matching the user's strongest genres. */
  expandPool: (genres: Genre[], decade?: number) => Promise<number>;
  remember: (films: Film[]) => void;
  tmdbKey: string;
  setTmdbKey: (key: string) => void;
  probe: () => Promise<tmdb.Probe>;
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
        const remote = await tmdb.searchFilms(query, cfg);
        remember(remote);
        // Local hits first — they are the ones you have a history with.
        const seen = new Set(local.map((f) => f.id));
        return [...local, ...remote.filter((f) => !seen.has(f.id))];
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

  const setTmdbKey = useCallback((key: string) => {
    try {
      if (key.trim()) localStorage.setItem(KEY_KEY, key.trim());
      else localStorage.removeItem(KEY_KEY);
    } catch {
      // Not persisted, but usable for this session.
    }
    setKeyState(key.trim());
  }, []);

  const probe = useCallback(async () => {
    if (!cfg) return { ok: false, message: 'No key set.' };
    setBusy(true);
    try {
      return await tmdb.probeTmdb(cfg);
    } finally {
      setBusy(false);
    }
  }, [cfg]);

  useEffect(() => {
    persistCache(cacheRef.current);
  }, []);

  const value = useMemo<CatalogueApi>(
    () => ({
      mode: cfg ? 'tmdb' : 'bundled',
      getFilm,
      candidates,
      bundled: CATALOGUE,
      search,
      expandPool,
      remember,
      tmdbKey,
      setTmdbKey,
      probe,
      busy,
      lastError,
    }),
    [cfg, getFilm, candidates, search, expandPool, remember, tmdbKey, setTmdbKey, probe, busy, lastError],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalogue(): CatalogueApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCatalogue must be used inside CatalogueProvider');
  return ctx;
}
