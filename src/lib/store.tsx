import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { AppState, Collection, Genre, LogEntry, Settings, WatchlistEntry } from './types';

const STORAGE_KEY = 'flick.v1';

export const DEFAULT_SETTINGS: Settings = {
  weights: { people: 82, affinity: 74, runtimeFit: 56, era: 38, community: 20 },
  runtimeCeiling: 180,
  excludedGenres: [],
  includeRewatches: true,
  surfaceObscure: true,
};

const DEFAULT_COLLECTIONS: Collection[] = [
  { id: 'neo-noir', name: 'Neo-noir / rain', colour: '#4EE2F2', filmIds: [] },
  { id: 'slow-scifi', name: 'Slow sci-fi', colour: '#FF4D9E', filmIds: [] },
  { id: 'rewatch', name: 'Rewatch queue', colour: '#FFB454', filmIds: [] },
];

const INITIAL: AppState = {
  log: [],
  watchlist: [],
  dismissed: [],
  deletedLogIds: [],
  collections: DEFAULT_COLLECTIONS,
  settings: DEFAULT_SETTINGS,
  onboarded: false,
};

export type Action =
  | { type: 'log'; entry: LogEntry; collections?: string[] }
  | { type: 'editLog'; entry: LogEntry }
  | { type: 'unlog'; id: string }
  | { type: 'watchlist/add'; filmId: string; source: string }
  | { type: 'watchlist/remove'; filmId: string }
  | { type: 'dismiss'; filmId: string }
  | { type: 'undismiss'; filmId: string }
  | { type: 'collection/toggle'; collectionId: string; filmId: string }
  | { type: 'collection/create'; name: string; colour: string }
  | { type: 'settings/patch'; patch: Partial<Settings> }
  | { type: 'settings/weight'; key: keyof Settings['weights']; value: number }
  | { type: 'settings/toggleGenre'; genre: Genre }
  | { type: 'onboard'; filmIds: string[] }
  | { type: 'replace'; state: AppState }
  | { type: 'reset' };

const today = () => new Date().toISOString().slice(0, 10);

export const newId = () =>
  `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Marks when an entry was written, so sync can tell two copies of it apart. */
const stamp = (e: LogEntry): LogEntry => ({ ...e, updatedAt: new Date().toISOString() });

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'log': {
      // Logging something clears it off the to-see list; that is the whole point of the list.
      const log = [stamp(action.entry), ...state.log].sort((a, b) => b.watchedOn.localeCompare(a.watchedOn));
      const collections = action.collections
        ? state.collections.map((c) =>
            action.collections!.includes(c.id) && !c.filmIds.includes(action.entry.filmId)
              ? { ...c, filmIds: [...c.filmIds, action.entry.filmId] }
              : c,
          )
        : state.collections;
      return {
        ...state,
        log,
        collections,
        watchlist: state.watchlist.filter((w) => w.filmId !== action.entry.filmId),
      };
    }
    case 'editLog':
      return {
        ...state,
        log: state.log
          .map((e) => (e.id === action.entry.id ? stamp(action.entry) : e))
          .sort((a, b) => b.watchedOn.localeCompare(a.watchedOn)),
      };
    case 'unlog':
      return {
        ...state,
        log: state.log.filter((e) => e.id !== action.id),
        // Bounded: a tombstone only has to outlive the other device's next sync.
        deletedLogIds: [action.id, ...state.deletedLogIds.filter((id) => id !== action.id)].slice(0, 500),
      };
    case 'watchlist/add': {
      if (state.watchlist.some((w) => w.filmId === action.filmId)) return state;
      const entry: WatchlistEntry = { filmId: action.filmId, addedOn: today(), source: action.source };
      return { ...state, watchlist: [entry, ...state.watchlist] };
    }
    case 'watchlist/remove':
      return { ...state, watchlist: state.watchlist.filter((w) => w.filmId !== action.filmId) };
    case 'dismiss':
      return state.dismissed.includes(action.filmId)
        ? state
        : { ...state, dismissed: [...state.dismissed, action.filmId] };
    case 'undismiss':
      return { ...state, dismissed: state.dismissed.filter((id) => id !== action.filmId) };
    case 'collection/toggle':
      return {
        ...state,
        collections: state.collections.map((c) =>
          c.id !== action.collectionId
            ? c
            : {
                ...c,
                filmIds: c.filmIds.includes(action.filmId)
                  ? c.filmIds.filter((id) => id !== action.filmId)
                  : [...c.filmIds, action.filmId],
              },
        ),
      };
    case 'collection/create': {
      const id = action.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `c${Date.now()}`;
      if (state.collections.some((c) => c.id === id)) return state;
      return {
        ...state,
        collections: [...state.collections, { id, name: action.name, colour: action.colour, filmIds: [] }],
      };
    }
    case 'settings/patch':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'settings/weight':
      return {
        ...state,
        settings: { ...state.settings, weights: { ...state.settings.weights, [action.key]: action.value } },
      };
    case 'settings/toggleGenre': {
      const has = state.settings.excludedGenres.includes(action.genre);
      return {
        ...state,
        settings: {
          ...state.settings,
          excludedGenres: has
            ? state.settings.excludedGenres.filter((g) => g !== action.genre)
            : [...state.settings.excludedGenres, action.genre],
        },
      };
    }
    case 'onboard': {
      // Seeded films get a neutral score — enough to place them, not enough to pretend we know.
      const day = today();
      const entries: LogEntry[] = action.filmIds.map((filmId) => ({
        id: newId(),
        filmId,
        watchedOn: day,
        rewatch: false,
        score: 7.5,
      }));
      return { ...state, log: [...entries, ...state.log], onboarded: true };
    }
    case 'replace':
      return action.state;
    case 'reset':
      return { ...INITIAL, onboarded: false };
    default:
      return state;
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...INITIAL,
      ...parsed,
      settings: {
        ...DEFAULT_SETTINGS,
        ...parsed.settings,
        weights: { ...DEFAULT_SETTINGS.weights, ...parsed.settings?.weights },
      },
      collections: parsed.collections?.length ? parsed.collections : DEFAULT_COLLECTIONS,
      dismissed: parsed.dismissed ?? [],
      deletedLogIds: parsed.deletedLogIds ?? [],
      // Entries saved before ids existed get one now, so older logs stay editable.
      log: (parsed.log ?? []).map((e) => (e.id ? e : { ...e, id: newId() })),
    };
  } catch {
    // Private windows, cleared site data, corrupt JSON — start clean rather than crash.
    return INITIAL;
  }
}

interface Store {
  state: AppState;
  dispatch: (a: Action) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Out of quota or storage blocked — the session still works, it just will not persist.
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
