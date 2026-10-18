import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCatalogue } from '../lib/catalogue';
import { computeStats } from '../lib/stats';
import { useStore } from '../lib/store';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { LogModal } from './LogModal';
import { ScrollMemory } from './ScrollMemory';
import type { LogEntry } from '../lib/types';

interface LogControl {
  openLog: (filmId?: string) => void;
  editLog: (entry: LogEntry) => void;
}
const LogCtx = createContext<LogControl>({ openLog: () => {}, editLog: () => {} });
export const useLogModal = () => useContext(LogCtx);

/** The last screen you were on that was not a film page. */
export interface Place {
  to: string;
  label: string;
}
const PlaceCtx = createContext<Place | null>(null);
export const useLastPlace = () => useContext(PlaceCtx);

function placeOf(pathname: string, search: string): Place {
  const to = pathname + search;
  if (pathname === '/search') {
    const q = new URLSearchParams(search).get('q')?.trim();
    return { to, label: q ? `BACK TO \u201C${q.slice(0, 24).toUpperCase()}\u201D` : 'BACK TO SEARCH' };
  }
  if (pathname === '/to-see') return { to, label: 'BACK TO YOUR TO SEE LIST' };
  if (pathname === '/seen') return { to, label: 'BACK TO SEEN' };
  if (pathname === '/for-you') return { to, label: 'BACK TO FOR YOU' };
  if (pathname === '/settings') return { to, label: 'BACK TO TUNE MY TASTE' };
  if (pathname === '/') return { to, label: 'BACK TO DASHBOARD' };
  return { to, label: 'BACK TO BROWSE' };
}

const NAV: {
  to: string;
  label: string;
  short: string;
  icon: IconName;
  count?: 'toSee' | 'seen';
  dot?: boolean;
}[] = [
  { to: '/', label: 'DASHBOARD', short: 'HOME', icon: 'dashboard' },
  { to: '/browse', label: 'BROWSE ALL', short: 'BROWSE', icon: 'browse' },
  { to: '/to-see', label: 'TO SEE', short: 'TO SEE', icon: 'tosee', count: 'toSee' },
  { to: '/seen', label: 'SEEN', short: 'SEEN', icon: 'seen', count: 'seen' },
  { to: '/for-you', label: 'FOR YOU', short: 'FOR YOU', icon: 'foryou', dot: true },
];

export function AppShell() {
  const { getFilm } = useCatalogue();
  const { state } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const stats = computeStats(state, getFilm);
  const [logFor, setLogFor] = useState<string | null | undefined>(undefined);
  const [editingEntry, setEditingEntry] = useState<LogEntry | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<Place | null>(null);

  /* Tracked here rather than threaded through every Link to a film: posters,
     search rows, the dashboard and For You all lead to one, and each would
     otherwise have to remember to say where it came from. Film pages are
     skipped so that following "more like this" twice still leaves the way
     back to the list you started from. */
  useEffect(() => {
    if (location.pathname.startsWith('/film/')) return;
    setPlace(placeOf(location.pathname, location.search));
  }, [location.pathname, location.search]);

  /* Arriving at the results from anywhere — a link, a reload, the back
     gesture — should leave the term sitting in the box, ready to be
     amended rather than retyped. */
  useEffect(() => {
    if (location.pathname !== '/search') return;
    setQuery(new URLSearchParams(location.search).get('q') ?? '');
  }, [location.pathname, location.search]);

  const openLog = (filmId?: string) => {
    setEditingEntry(undefined);
    setLogFor(filmId ?? null);
  };
  const editLog = (entry: LogEntry) => {
    setEditingEntry(entry);
    setLogFor(entry.filmId);
  };

  return (
    <LogCtx.Provider value={{ openLog, editLog }}>
      <PlaceCtx.Provider value={place}>
        <ScrollMemory />
        <div className="atmo" />
        <div className="grain" />
        <div className="scan" />

        <div className="shell">
          <nav className="rail" aria-label="Main">
            <div className="rail-brand">
              <b>FLICK</b>
              <div className="meta" style={{ marginTop: 7, color: 'var(--ink-7)', letterSpacing: '0.16em' }}>
                FILM INDEX / 0.1
              </div>
            </div>

            <div className="rail-group rail-nav">
              <div className="lbl">Library</div>
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                >
                  {({ isActive }) => (
                    <>
                      <Icon name={item.icon} colour={isActive ? 'var(--cyan)' : 'var(--ink-4)'} />
                      <span className="nav-full">{item.label}</span>
                      <span className="nav-short">{item.short}</span>
                      {item.count && <span className="count">{item.count === 'toSee' ? stats.toSee : stats.seen}</span>}
                      {item.dot && stats.seen > 0 && <span className="nav-dot" />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            <div className="rail-divider" />

            <div className="rail-group rail-collections">
              <div className="lbl">Collections</div>
              {state.collections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="rail-collection"
                  onClick={() => navigate(`/browse?collection=${c.id}`)}
                >
                  <i style={{ background: c.colour }} />
                  <span>{c.name}</span>
                  {c.filmIds.length > 0 && <span className="count" style={{ marginLeft: 'auto' }}>{c.filmIds.length}</span>}
                </button>
              ))}
            </div>

            <div className="rail-user">
              <div className="avatar">RS</div>
              <div>
                <div style={{ font: '500 13px var(--sans)', letterSpacing: '0.06em', color: 'var(--ink-2)' }}>You</div>
                <div className="meta" style={{ color: 'var(--ink-7)', fontSize: 10 }}>
                  {stats.seen > 0 ? `${stats.seen} LOGGED` : 'NEW ACCOUNT'}
                </div>
              </div>
            </div>
          </nav>

          <div className="main">
            <header className="topbar">
              <form
                className="field"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
                }}
              >
                <Icon name="search" size={17} colour="var(--ink-6)" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search titles, people, collections"
                  aria-label="Search"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                    <Icon name="close" size={15} width={1.8} colour="var(--ink-5)" />
                  </button>
                )}
              </form>

              <button type="button" className="btn btn-icon-sm" onClick={() => navigate('/settings')} aria-label="Tune my taste">
                <Icon name="filters" size={17} width={1.5} />
                <span className="btn-label">TUNE</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                style={{ marginLeft: 'auto' }}
                onClick={() => openLog()}
              >
                <Icon name="plus" size={16} width={1.8} colour="var(--void)" />
                <span className="btn-label">LOG A FILM</span>
              </button>
            </header>

            <Outlet />
          </div>
        </div>

        {logFor !== undefined && (
          <LogModal
            filmId={logFor}
            editing={editingEntry}
            onClose={() => {
              setLogFor(undefined);
              setEditingEntry(undefined);
            }}
          />
        )}
      </PlaceCtx.Provider>
    </LogCtx.Provider>
  );
}
