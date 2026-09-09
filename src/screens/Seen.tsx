import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFilm } from '../data/catalogue';
import { Thumb } from '../components/Poster';
import { Chip, Meter, SectionHead } from '../components/ui';
import { computeStats, genreCounts, groupByMonth, loggedYears, perMonth } from '../lib/stats';
import { useStore } from '../lib/store';

export function Seen() {
  const { state } = useStore();
  const stats = computeStats(state, getFilm);
  const years = loggedYears(state.log);
  const [year, setYear] = useState<number | 'all'>(years[0] ?? 'all');

  const scoped = useMemo(
    () => (year === 'all' ? state.log : state.log.filter((e) => e.watchedOn.startsWith(String(year)))),
    [state.log, year],
  );

  const groups = groupByMonth(scoped);
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
          {groups.map((g) => (
            <div key={g.key}>
              <SectionHead
                title={g.label}
                right={<span className="meta" style={{ fontSize: 10, color: 'var(--ink-6)' }}>{g.entries.length} FILMS</span>}
              />
              {g.entries.map((e, i) => {
                const f = getFilm(e.filmId);
                if (!f) return null;
                return (
                  <div key={`${e.filmId}-${e.watchedOn}-${i}`} className="log-row">
                    <span className="meta" style={{ width: 30, color: 'var(--ink-7)', fontSize: 10.5 }}>
                      {e.watchedOn.slice(8, 10)}
                    </span>
                    <Thumb film={f} w={34} h={48} />
                    <div style={{ width: 230 }}>
                      <Link to={`/film/${f.id}`} style={{ font: '500 15px var(--sans)', letterSpacing: '0.03em', color: 'var(--ink)' }}>{f.title}</Link>
                      <div className="meta" style={{ marginTop: 4, fontSize: 10 }}>{f.year} / {f.director.toUpperCase()}</div>
                    </div>
                    <span className="meta" style={{ width: 96, fontSize: 10, color: e.rewatch ? 'var(--amber)' : 'var(--ink-8)' }}>
                      {e.rewatch ? 'REWATCH' : 'FIRST WATCH'}
                    </span>
                    <span style={{ flexGrow: 1 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 92 }}>
                        <Meter pct={e.score * 10} />
                      </div>
                      <span style={{ width: 30, textAlign: 'right', font: '500 14px var(--mono)', color: 'var(--ink)' }}>
                        {e.score.toFixed(1)}
                      </span>
                    </div>
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
