import { Link } from 'react-router-dom';
import { useCatalogue } from '../lib/catalogue';
import { useLogModal } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { Poster, Thumb } from '../components/Poster';
import { posterUrl } from '../lib/tmdb';
import { StarterBanner } from '../components/StarterBanner';
import { Meter, SectionHead, Stat } from '../components/ui';
import { buildTaste, formatRuntime, recommend } from '../lib/recommend';
import { computeStats } from '../lib/stats';
import { useStore } from '../lib/store';

const TAG_LABEL: Record<string, string> = {
  cerebral: 'Cerebral',
  slow: 'Slow cinema',
  'noir-lighting': 'Neo-noir',
  bleak: 'Bleak',
  space: 'Space',
  arthouse: 'Arthouse',
  blockbuster: 'Blockbuster',
  anime: 'Animation',
  'time-loop': 'Time loops',
  memory: 'Memory',
  dystopia: 'Dystopia',
  'practical-fx': 'Practical effects',
};

export function Dashboard() {
  const { candidates, getFilm } = useCatalogue();
  const { state, dispatch } = useStore();
  const { openLog } = useLogModal();
  const stats = computeStats(state, getFilm);
  const taste = buildTaste(state.log, getFilm);
  const recs = recommend(state, candidates, getFilm, 8);
  const top = recs[0];

  const nextUp = state.watchlist
    .map((w) => ({ w, film: getFilm(w.filmId) }))
    .filter((x): x is { w: typeof x.w; film: NonNullable<typeof x.film> } => Boolean(x.film))
    .slice(0, 4);

  const recent = state.log.slice(0, 6);

  const signals = [...taste.tag.entries()]
    .filter(([t]) => TAG_LABEL[t])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="screen" style={{ gap: 28 }}>
      <StarterBanner />

      {top && (
        <section className="panel hero">
          <div className="hero-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="lbl" style={{ color: 'var(--cyan)' }}>Tonight&rsquo;s pick</span>
              <span style={{ width: 26, height: 1, background: 'var(--edge-3)' }} />
              <span className="meta" style={{ color: 'var(--cyan)', letterSpacing: '0.14em' }}>{top.match}% MATCH</span>
            </div>

            <Link to={`/film/${top.film.id}`} style={{ marginTop: 16, font: '600 44px var(--sans)', letterSpacing: '0.03em', lineHeight: 1.02, color: 'var(--ink-hi)', textWrap: 'pretty' }}>
              {top.film.title.toUpperCase()}
            </Link>
            <div className="meta" style={{ marginTop: 10 }}>
              {top.film.year} &nbsp;/&nbsp; {top.film.director.toUpperCase()} &nbsp;/&nbsp; {formatRuntime(top.film.runtime).toUpperCase()} &nbsp;/&nbsp; {top.film.country.toUpperCase()}
            </div>

            <p style={{ marginTop: 16, maxWidth: 420, font: '300 13.5px var(--sans)', lineHeight: 1.65, color: 'var(--ink-3)', textWrap: 'pretty' }}>
              {top.reasons[0] ?? top.film.synopsis}
              {top.reasons[1] ? `. ${top.reasons[1]}.` : ''}
            </p>

            <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={() => openLog(top.film.id)}>
                <Icon name="check" size={15} width={2.2} colour="var(--void)" />
                MARK SEEN
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => dispatch({ type: 'watchlist/add', filmId: top.film.id, source: top.reasons[0] ?? 'Tonight’s pick' })}
              >
                <Icon name="tosee" size={15} width={1.6} />
                ADD TO SEE
              </button>
              <Link to={`/film/${top.film.id}`} className="btn btn-ghost">DETAILS</Link>
            </div>
          </div>

          <div className={`hero-art art-${top.film.art}`} aria-hidden="true">
            {top.film.posterPath && <img className="art-img" src={posterUrl(top.film.posterPath, 'w500')} alt="" />}
          </div>
        </section>
      )}

      <section className="stat-grid">
        <Stat label="Seen" value={String(stats.seen)} note={stats.seenLast30 ? `+${stats.seenLast30} / 30D` : undefined} />
        <Stat label="To see" value={String(stats.toSee)} note={stats.addedLast30 ? `+${stats.addedLast30} / 30D` : undefined} />
        <Stat label="Hours logged" value={String(stats.hours)} note={stats.hours >= 24 ? `${Math.round(stats.hours / 24)} DAYS` : undefined} />
        <Stat label="Mean score" value={stats.meanScore ? stats.meanScore.toFixed(1) : '—'} note="/ 10" accent />
      </section>

      <div className="dash">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionHead
            title="NEXT UP ON YOUR LIST"
            right={<Link to="/to-see" className="meta" style={{ color: 'var(--ink-4)' }}>VIEW ALL {stats.toSee}</Link>}
          />
          {nextUp.length ? (
            <div className="grid-posters">
              {nextUp.map(({ film }) => (
                <Poster key={film.id} film={film} status="listed" />
              ))}
            </div>
          ) : (
            <div className="empty-note">
              Nothing on your list yet. Add something from <Link to="/for-you">For you</Link> or{' '}
              <Link to="/browse">Browse</Link>.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="panel">
            <div className="panel-head">
              <span className="h3">RECENTLY LOGGED</span>
              <span className="meta" style={{ color: 'var(--ink-7)', fontSize: 10 }}>LAST {recent.length}</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {recent.length === 0 && <div className="empty-note" style={{ border: 'none' }}>Nothing logged yet.</div>}
              {recent.map((e, i) => {
                const f = getFilm(e.filmId);
                if (!f) return null;
                return (
                  <Link key={`${e.filmId}-${e.watchedOn}-${i}`} to={`/film/${f.id}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 20px' }}>
                    <Thumb film={f} w={40} h={58} />
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <div style={{ font: '500 13.5px var(--sans)', letterSpacing: '0.03em', color: 'var(--ink)' }}>{f.title}</div>
                      <div className="meta" style={{ marginTop: 3, fontSize: 10 }}>
                        {new Date(e.watchedOn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()} / {e.rewatch ? 'REWATCH' : 'FIRST WATCH'}
                      </div>
                    </div>
                    <span style={{ font: '500 14px var(--mono)', color: e.score >= taste.meanScore ? 'var(--cyan)' : 'var(--ink-4)' }}>
                      {e.score.toFixed(1)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {signals.length === 0 && state.log.length > 0 && (
            <div className="panel" style={{ padding: 20 }}>
              <span className="h3">TASTE SIGNAL</span>
              <p style={{ margin: '14px 0 0', font: '300 13px var(--sans)', lineHeight: 1.6, color: 'var(--ink-5)' }}>
                Every film in your log has the same score, so there is nothing to separate yet. Re-rate a few and
                the signal appears.
              </p>
            </div>
          )}

          {signals.length > 0 && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="h3">TASTE SIGNAL</span>
                <span className="meta" style={{ color: 'var(--ink-7)', fontSize: 10 }}>{stats.seen} FILMS</span>
              </div>
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {signals.map(([tag, weight]) => (
                  <div key={tag}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ font: '300 12.5px var(--sans)', color: 'var(--ink-3)' }}>{TAG_LABEL[tag]}</span>
                      <span className="meta" style={{ fontSize: 10 }}>{Math.round(weight * 100)}</span>
                    </div>
                    <div style={{ marginTop: 7 }}>
                      <Meter pct={weight * 100} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
