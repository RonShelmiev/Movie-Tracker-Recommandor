import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogue } from '../lib/catalogue';
import { useLogModal } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { Thumb } from '../components/Poster';
import { Chip, Meter } from '../components/ui';
import { formatRuntime, recommend } from '../lib/recommend';
import { computeStats } from '../lib/stats';
import { useStore } from '../lib/store';

type Filter = 'all' | 'short' | 'month' | 'high';

export function ToSee() {
  const { candidates, getFilm } = useCatalogue();
  const { state, dispatch } = useStore();
  const { openLog } = useLogModal();
  const stats = computeStats(state, getFilm);
  const [filter, setFilter] = useState<Filter>('all');

  // Match scores come from the same engine that produced the recommendations.
  const matchById = useMemo(() => {
    const all = recommend(
      { ...state, watchlist: [] },
      candidates,
      getFilm,
      candidates.length,
    );
    return new Map(all.map((r) => [r.film.id, r.match]));
  }, [state]);

  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const rows = useMemo(() => {
    const out = state.watchlist
      .map((w) => ({ w, film: getFilm(w.filmId) }))
      .filter((x): x is { w: (typeof state.watchlist)[number]; film: NonNullable<ReturnType<typeof getFilm>> } => Boolean(x.film))
      .filter(({ w, film }) => {
        if (filter === 'short') return film.runtime < 120;
        if (filter === 'month') return w.addedOn >= monthAgo;
        if (filter === 'high') return (matchById.get(film.id) ?? 0) >= 80;
        return true;
      });
    out.sort((a, b) => (matchById.get(b.film.id) ?? 0) - (matchById.get(a.film.id) ?? 0));
    return out;
  }, [state.watchlist, filter, matchById, monthAgo]);

  return (
    <div className="screen" style={{ gap: 22 }}>
      <div className="screen-head">
        <div>
          <h1 className="h1">TO SEE</h1>
          <div className="meta">
            {stats.toSee} {stats.toSee === 1 ? 'FILM' : 'FILMS'} / {formatRuntime(stats.queuedMinutes).toUpperCase()} QUEUED
            {stats.addedLast30 > 0 && ` / ${stats.addedLast30} ADDED THIS MONTH`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Chip label={`All ${state.watchlist.length}`} on={filter === 'all'} onClick={() => setFilter('all')} />
        <Chip label="Under 2h" on={filter === 'short'} onClick={() => setFilter('short')} />
        <Chip label="Added this month" on={filter === 'month'} onClick={() => setFilter('month')} />
        <Chip label="Match 80+" on={filter === 'high'} onClick={() => setFilter('high')} />
      </div>

      {rows.length === 0 ? (
        <div className="empty-note">
          {state.watchlist.length === 0 ? (
            <>Nothing on the list. Pick something from <Link to="/for-you">For you</Link>.</>
          ) : (
            'Nothing matches that filter.'
          )}
        </div>
      ) : (
        <div className="list">
          <div className="list-head">
            <span className="lbl" style={{ width: 22 }}>#</span>
            <span style={{ width: 50 }} />
            <span className="lbl" style={{ width: 250 }}>Title</span>
            <span className="lbl" style={{ flexGrow: 1 }}>Why it is here</span>
            <span className="lbl" style={{ width: 108 }}>Match</span>
            <span className="lbl" style={{ width: 92 }}>Added</span>
            <span style={{ width: 96 }} />
          </div>

          {rows.map(({ w, film }, i) => (
            <div key={film.id} className="list-row">
              <span className="meta" style={{ width: 22, color: 'var(--ink-8)' }}>{String(i + 1).padStart(2, '0')}</span>
              <Thumb film={film} w={50} h={72} />
              <div style={{ width: 250 }}>
                <Link to={`/film/${film.id}`} style={{ font: '500 17px var(--sans)', letterSpacing: '0.03em', color: 'var(--ink-hi)' }}>
                  {film.title}
                </Link>
                <div className="meta" style={{ marginTop: 6, fontSize: 10.5 }}>
                  {film.year} / {film.director.toUpperCase()} / {formatRuntime(film.runtime).toUpperCase()}
                </div>
              </div>
              <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 4, height: 4, flexShrink: 0, background: 'var(--magenta)' }} />
                <span style={{ font: '300 13px var(--sans)', color: 'var(--ink-4)' }}>{w.source}</span>
              </div>
              <div style={{ width: 108, display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 54 }}>
                  <Meter pct={matchById.get(film.id) ?? 0} />
                </div>
                <span style={{ font: '500 12px var(--mono)', color: 'var(--ink-2)' }}>{matchById.get(film.id) ?? '—'}</span>
              </div>
              <span className="meta" style={{ width: 92, fontSize: 10, color: 'var(--ink-7)' }}>
                {new Date(w.addedOn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn" style={{ width: 44, padding: 0, justifyContent: 'center' }} title="Mark seen" onClick={() => openLog(film.id)}>
                  <Icon name="seen" size={17} width={1.7} colour="var(--cyan)" />
                </button>
                <button type="button" className="btn" style={{ width: 44, padding: 0, justifyContent: 'center' }} title="Remove from list" onClick={() => dispatch({ type: 'watchlist/remove', filmId: film.id })}>
                  <Icon name="close" size={15} width={1.8} colour="var(--ink-6)" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
