import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogue } from '../lib/catalogue';
import { useLogModal } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { Poster, Thumb } from '../components/Poster';
import { Chip, Meter, SectionHead, Stars } from '../components/ui';
import { computeStats, genreCounts, groupSeen, loggedYears, perMonth } from '../lib/stats';
import type { SeenSort } from '../lib/stats';
import { useStore } from '../lib/store';

const SORTS: { id: SeenSort; label: string; desc: string; asc: string }[] = [
  { id: 'watched', label: 'Date watched', desc: 'Newest first', asc: 'Oldest first' },
  { id: 'score', label: 'Score', desc: 'Highest first', asc: 'Lowest first' },
  { id: 'year', label: 'Release year', desc: 'Newest first', asc: 'Oldest first' },
  { id: 'genre', label: 'Genre', desc: 'Best first', asc: 'Worst first' },
];

const SORT_KEY = 'flick.seenSort.v1';
const VIEW_KEY = 'flick.seenView.v1';
type View = 'list' | 'posters';

function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'posters' ? 'posters' : 'list';
  } catch {
    return 'list';
  }
}

/** The last sort you picked, remembered on this device only. */
function loadSort(): { sort: SeenSort; desc: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(SORT_KEY) ?? 'null') as { sort?: string; desc?: boolean } | null;
    if (v && SORTS.some((s) => s.id === v.sort)) return { sort: v.sort as SeenSort, desc: v.desc !== false };
  } catch {
    /* unavailable or corrupt — fall back to the default */
  }
  return { sort: 'watched', desc: true };
}

export function Seen() {
  const { getFilm } = useCatalogue();
  const { state } = useStore();
  const { editLog } = useLogModal();
  const stats = computeStats(state, getFilm);
  const years = loggedYears(state.log);
  const [year, setYear] = useState<number | 'all'>(years[0] ?? 'all');

  const scoped = useMemo(
    () => (year === 'all' ? state.log : state.log.filter((e) => e.watchedOn.startsWith(String(year)))),
    [state.log, year],
  );

  const [order, setOrder] = useState(loadSort);
  const [onlyGenre, setOnlyGenre] = useState<string | null>(null);
  // The list is for editing; the poster wall is for looking at what you
  // have seen, the way Letterboxd shows a diary.
  const [view, setView] = useState<View>(loadView);
  const pickView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* not remembered, still applied */
    }
  };
  const pickOrder = (next: { sort: SeenSort; desc: boolean }) => {
    setOrder(next);
    try {
      localStorage.setItem(SORT_KEY, JSON.stringify(next));
    } catch {
      /* not remembered, still applied */
    }
  };
  const sortMeta = SORTS.find((x) => x.id === order.sort)!;

  const allGroups = useMemo(
    () => groupSeen(scoped, getFilm, order.sort, order.desc),
    [scoped, getFilm, order],
  );
  // By genre, every film appears once per genre it carries, so the full list
  // is long; a genre row lets you jump to one. It only offers genres that are
  // actually in this slice of the log.
  const genreChoice = onlyGenre && allGroups.some((g) => g.key === onlyGenre) ? onlyGenre : null;
  const groups = order.sort === 'genre' && genreChoice ? allGroups.filter((g) => g.key === genreChoice) : allGroups;
  const months = perMonth(state.log, typeof year === 'number' ? year : new Date().getFullYear());
  const maxMonth = Math.max(1, ...months.map((m) => m.count));
  const genres = genreCounts(scoped, getFilm).slice(0, 5);
  const maxGenre = Math.max(1, ...genres.map((g) => g.count));

  const best = [...scoped]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((e) => ({ e, f: getFilm(e.filmId) }))
    .filter((x): x is { e: typeof x.e; f: NonNullable<typeof x.f> } => Boolean(x.f));

  const yearMean = scoped.length ? scoped.reduce((s, e) => s + e.score, 0) / scoped.length : 0;
  const rewatches = scoped.filter((e) => e.rewatch).length;

  if (state.log.length === 0) {
    return (
      <div className="screen">
        <div className="screen-head">
          <div>
            <h1 className="h1">SEEN</h1>
            <div className="meta">NOTHING LOGGED YET</div>
          </div>
        </div>
        <div className="empty-note" style={{ marginTop: 30 }}>
          Your history is empty. <Link to="/">Log something</Link> and it will show up here.
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ gap: 26 }}>
      <div className="screen-head">
        <div>
          <h1 className="h1">SEEN</h1>
          <div className="meta">
            {stats.seen} FILMS / {stats.hours} HOURS / {stats.distinct} DISTINCT TITLES
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {years.map((y) => (
            <Chip key={y} label={String(y)} on={year === y} onClick={() => setYear(y)} />
          ))}
          <Chip label="All time" on={year === 'all'} onClick={() => setYear('all')} />
        </div>
      </div>

      <div className="split">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="sort-bar">
            <div className="sort-head">
              <div className="view-switch" role="group" aria-label="View">
                <button type="button" aria-pressed={view === 'list'} onClick={() => pickView('list')}>LIST</button>
                <button type="button" aria-pressed={view === 'posters'} onClick={() => pickView('posters')}>POSTERS</button>
              </div>
              <button
                type="button"
                className="sort-dir"
                onClick={() => pickOrder({ ...order, desc: !order.desc })}
                aria-label={`Order: ${order.desc ? sortMeta.desc : sortMeta.asc}. Tap to reverse.`}
              >
                <span className={order.desc ? 'sort-arrow' : 'sort-arrow is-up'} aria-hidden="true">
                  <Icon name="chevron-down" size={13} width={2} colour="var(--cyan)" />
                </span>
                <span>{(order.desc ? sortMeta.desc : sortMeta.asc).toUpperCase()}</span>
              </button>
            </div>
            <div className="filter-row">
              {SORTS.map((x) => (
                <Chip
                  key={x.id}
                  label={x.label}
                  on={order.sort === x.id}
                  onClick={() => pickOrder({ sort: x.id, desc: order.sort === x.id ? order.desc : true })}
                />
              ))}
            </div>
            {order.sort === 'genre' && allGroups.length > 1 && (
              <div className="filter-row">
                <Chip label="All genres" on={!genreChoice} onClick={() => setOnlyGenre(null)} />
                {allGroups.map((g) => (
                  <Chip key={g.key} label={`${g.key} ${g.entries.length}`} on={genreChoice === g.key} onClick={() => setOnlyGenre(g.key)} />
                ))}
              </div>
            )}
          </div>

          {groups.map((g) => (
            <div key={g.key}>
              <SectionHead
                title={g.label}
                right={<span className="meta" style={{ fontSize: 10, color: 'var(--ink-6)' }}>{g.entries.length} {g.entries.length === 1 ? 'FILM' : 'FILMS'}</span>}
              />
              {view === 'posters' ? (
                <div className="seen-wall">
                  {g.entries.map((e) => {
                    const f = getFilm(e.filmId);
                    if (!f) return null;
                    return (
                      <div key={`${e.id}-${g.key}`} className="seen-tile">
                        <Poster film={f} caption={false} />
                        {/* Tapping the stars edits the score, like a row in the list. */}
                        <button type="button" className="seen-tile-score" onClick={() => editLog(e)} aria-label={`Edit the score for ${f.title}`}>
                          <Stars score={e.score} size={11} />
                          <span>{e.score.toFixed(1)}</span>
                        </button>
                        {e.rewatch && <span className="seen-tile-re" title="Rewatch">↻</span>}
                      </div>
                    );
                  })}
                </div>
              ) : g.entries.map((e) => {
                const f = getFilm(e.filmId);
                if (!f) return null;
                const byDate = order.sort === 'watched';
                return (
                  <div key={`${e.id}-${g.key}`} className="log-row">
                    {/* The day of the month under a month heading; otherwise the
                        heading says nothing about when, so the full date joins
                        the first-watch flag instead. */}
                    <span className="log-day meta">{byDate ? e.watchedOn.slice(8, 10) : ''}</span>
                    <span className="log-art">
                      <Thumb film={f} w={34} h={48} />
                    </span>
                    <div className="log-main">
                      <Link to={`/film/${f.id}`} className="log-title">{f.title}</Link>
                      <div className="meta log-sub">
                        {f.year} / {f.director.toUpperCase()}
                      </div>
                    </div>
                    <span className="log-kind meta" style={{ color: e.rewatch ? 'var(--amber)' : 'var(--ink-8)' }}>
                      {e.rewatch ? 'REWATCH' : 'FIRST WATCH'}
                      {!byDate && (
                        <span className="log-when">
                          {new Date(e.watchedOn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}
                        </span>
                      )}
                    </span>
                    {/* The score is the thing people come here to change, so it
                        is the control — this screen used to be read-only, which
                        left deleting and re-logging as the only way to fix a
                        rating. */}
                    <button
                      type="button"
                      className="score-edit"
                      onClick={() => editLog(e)}
                      aria-label={`Edit the score for ${f.title}`}
                    >
                      <span className="score-meter">
                        <Meter pct={e.score * 10} />
                      </span>
                      <span style={{ width: 30, textAlign: 'right', font: '500 14px var(--mono)', color: 'var(--ink)' }}>
                        {e.score.toFixed(1)}
                      </span>
                      <Icon name="pencil" size={13} width={1.6} colour="var(--ink-6)" />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span className="h3">FILMS PER MONTH</span>
              <span className="meta" style={{ fontSize: 10, color: 'var(--ink-6)' }}>
                {typeof year === 'number' ? year : new Date().getFullYear()}
              </span>
            </div>
            <div style={{ marginTop: 18, display: 'flex', alignItems: 'flex-end', gap: 4, height: 136 }}>
              {months.map((m, i) => {
                const peak = m.count === maxMonth && m.count > 0;
                return (
                  <div key={i} style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span style={{ font: '500 10px var(--mono)', color: peak ? 'var(--cyan)' : 'transparent' }}>{m.count}</span>
                    <div
                      style={{
                        width: '100%',
                        height: Math.round((m.count / maxMonth) * 84),
                        minHeight: m.count ? 2 : 0,
                        background: peak ? 'var(--cyan)' : 'rgba(78,226,242,0.42)',
                        borderRadius: '3px 3px 0 0',
                      }}
                    />
                    <span style={{ font: '400 10px var(--mono)', color: 'var(--ink-7)' }}>{m.label}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="lbl" style={{ fontSize: 9 }}>{year === 'all' ? 'Total' : 'This year'}</div>
                <div style={{ marginTop: 6, font: '500 22px var(--sans)', color: 'var(--ink-hi)' }}>{scoped.length}</div>
              </div>
              <div>
                <div className="lbl" style={{ fontSize: 9 }}>Rewatches</div>
                <div style={{ marginTop: 6, font: '500 22px var(--sans)', color: 'var(--ink-hi)' }}>{rewatches}</div>
              </div>
              <div>
                <div className="lbl" style={{ fontSize: 9 }}>Mean</div>
                <div style={{ marginTop: 6, font: '500 22px var(--sans)', color: 'var(--cyan)' }}>{yearMean ? yearMean.toFixed(1) : '—'}</div>
              </div>
            </div>
          </div>

          {genres.length > 0 && (
            <div className="panel" style={{ padding: 20 }}>
              <span className="h3">MOST LOGGED GENRES</span>
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 15 }}>
                {genres.map((g) => (
                  <div key={g.genre}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ font: '300 12.5px var(--sans)', color: 'var(--ink-3)' }}>{g.genre}</span>
                      <span className="meta" style={{ fontSize: 10 }}>{g.count} {g.count === 1 ? 'film' : 'films'}</span>
                    </div>
                    <div style={{ marginTop: 7 }}>
                      <Meter pct={(g.count / maxGenre) * 100} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {best.length > 0 && (
            <div className="panel" style={{ padding: 20 }}>
              <span className="h3">HIGHEST RATED</span>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {best.map(({ e, f }, i) => (
                  <Link key={f.id + i} to={`/film/${f.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 42 }}>
                    <span className="meta" style={{ width: 14, color: 'var(--ink-8)', fontSize: 10 }}>{i + 1}</span>
                    <Thumb film={f} w={26} h={36} />
                    <span style={{ flexGrow: 1, minWidth: 0, font: '300 13.5px var(--sans)', color: 'var(--ink-2)' }}>{f.title}</span>
                    <span className="meta" style={{ fontSize: 10, color: 'var(--ink-7)' }}>{f.year}</span>
                    <span style={{ width: 30, textAlign: 'right', font: '500 13px var(--mono)', color: 'var(--cyan)' }}>{e.score.toFixed(1)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
