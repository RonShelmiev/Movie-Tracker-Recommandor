import { createContext, useContext, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getFilm } from '../data/catalogue';
import { computeStats } from '../lib/stats';
import { useStore } from '../lib/store';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { LogModal } from './LogModal';

interface LogControl {
  openLog: (filmId?: string) => void;
}
const LogCtx = createContext<LogControl>({ openLog: () => {} });
export const useLogModal = () => useContext(LogCtx);

const NAV: { to: string; label: string; icon: IconName; count?: 'toSee' | 'seen'; dot?: boolean }[] = [
  { to: '/', label: 'DASHBOARD', icon: 'dashboard' },
  { to: '/browse', label: 'BROWSE ALL', icon: 'browse' },
  { to: '/to-see', label: 'TO SEE', icon: 'tosee', count: 'toSee' },
  { to: '/seen', label: 'SEEN', icon: 'seen', count: 'seen' },
  { to: '/for-you', label: 'FOR YOU', icon: 'foryou', dot: true },
];

export function AppShell() {
  const { state } = useStore();
  const navigate = useNavigate();
  const stats = computeStats(state, getFilm);
  const [logFor, setLogFor] = useState<string | null | undefined>(undefined);
  const [query, setQuery] = useState('');

  const openLog = (filmId?: string) => setLogFor(filmId ?? null);

  return (
    <LogCtx.Provider value={{ openLog }}>
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

          <div className="rail-group">
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
                    <span>{item.label}</span>
                    {item.count && <span className="count">{item.count === 'toSee' ? stats.toSee : stats.seen}</span>}
                    {item.dot && stats.seen > 0 && <span className="nav-dot" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          <div className="rail-divider" />

          <div className="rail-group">
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

            <button type="button" className="btn" onClick={() => navigate('/settings')}>
              <Icon name="filters" size={17} width={1.5} />
              TUNE
            </button>

            <button
              type="button"
              className="btn btn-primary"
              style={{ marginLeft: 'auto' }}
              onClick={() => openLog()}
            >
              <Icon name="plus" size={16} width={1.8} colour="var(--void)" />
              LOG A FILM
            </button>
          </header>

          <Outlet />
        </div>
      </div>

      {logFor !== undefined && <LogModal filmId={logFor} onClose={() => setLogFor(undefined)} />}
    </LogCtx.Provider>
  );
}
