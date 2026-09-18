import { Link } from 'react-router-dom';
import { useCatalogue } from '../lib/catalogue';
import { Icon } from '../components/Icon';
import { Thumb } from '../components/Poster';
import { posterUrl } from '../lib/tmdb';
import { SectionHead } from '../components/ui';
import { recommend, seedClusters } from '../lib/recommend';
import { useStore } from '../lib/store';

export function ForYou() {
  const { candidates, getFilm } = useCatalogue();
  const { state, dispatch } = useStore();
  const recs = recommend(state, candidates, getFilm, 12);
  const clusters = seedClusters(recs, state, getFilm);
  const top = recs.slice(0, 3);

  if (state.log.length === 0) {
    return (
      <div className="screen">
        <div className="screen-head">
          <div>
            <h1 className="h1">FOR YOU</h1>
            <div className="meta">NOTHING TO GO ON YET</div>
          </div>
        </div>
        <div className="empty-note" style={{ marginTop: 30 }}>
          Log a few films and the engine has something to work from. <Link to="/">Start here</Link>.
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ gap: 26 }}>
      <div className="screen-head">
        <div>
          <h1 className="h1">FOR YOU</h1>
          <div className="meta">
            FROM {state.log.length} LOGGED {state.log.length === 1 ? 'FILM' : 'FILMS'} / {clusters.length} SIGNALS
          </div>
        </div>
        <Link to="/settings" className="btn btn-sm" style={{ height: 40 }}>
          <Icon name="filters" size={15} width={1.6} />
          TUNE MY TASTE
        </Link>
      </div>

      {top.length === 0 ? (
        <div className="empty-note">
          Your hard rules have filtered everything out. <Link to="/settings">Loosen them</Link>.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {top.map((rec) => (
            <article key={rec.film.id} className="panel rec-card">
              <div className={`rec-art art-${rec.film.art}`} aria-hidden="true">
                {rec.film.posterPath && <img className="art-img" src={posterUrl(rec.film.posterPath, 'w342')} alt="" />}
              </div>
              <div style={{ flexGrow: 1, minWidth: 0, padding: 20, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ font: '500 26px var(--sans)', color: 'var(--cyan)' }}>{rec.match}</span>
                  <span className="lbl" style={{ color: 'var(--cyan)' }}>% match</span>
                </div>
                <Link to={`/film/${rec.film.id}`} style={{ marginTop: 14, font: '600 21px var(--sans)', lineHeight: 1.15, letterSpacing: '0.02em', color: 'var(--ink-hi)', textWrap: 'pretty' }}>
                  {rec.film.title.toUpperCase()}
                </Link>
                <div className="meta" style={{ marginTop: 8, fontSize: 10 }}>
                  {rec.film.year} / {rec.film.director.split(" ").pop()?.toUpperCase()} / {Math.floor(rec.film.runtime / 60)}H{String(rec.film.runtime % 60).padStart(2, "0")}
                </div>
                <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rec.reasons.map((r) => (
                    <li key={r} style={{ display: 'flex', gap: 10, font: '300 13px var(--sans)', lineHeight: 1.5, color: 'var(--ink-3)' }}>
                      <span style={{ marginTop: 7, width: 4, height: 4, flexShrink: 0, background: 'var(--magenta)' }} />
                      {r}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ justifyContent: 'center' }}
                    onClick={() => dispatch({ type: 'watchlist/add', filmId: rec.film.id, source: rec.reasons[0] ?? 'Recommended for you' })}
                  >
                    <Icon name="tosee" size={14} width={2} colour="var(--void)" />
                    ADD TO SEE
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ justifyContent: 'center', borderColor: 'var(--edge-2)', color: 'var(--ink-5)' }}
                    onClick={() => dispatch({ type: 'dismiss', filmId: rec.film.id })}
                    title="Never recommend this again"
                  >
                    NOT FOR ME
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {clusters.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <SectionHead title="WHERE THESE CAME FROM" />
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {clusters.map((c) => (
              <div key={c.seed.id} style={{ border: '1px solid var(--edge)', background: 'rgba(9,14,22,0.45)', padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottom: '1px solid var(--hairline)' }}>
                  <Thumb film={c.seed} w={34} h={48} />
                  <div style={{ minWidth: 0 }}>
                    <div className="lbl" style={{ fontSize: 9 }}>Because you rated</div>
                    <div style={{ marginTop: 5, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <Link to={`/film/${c.seed.id}`} style={{ font: '500 15px var(--sans)', color: 'var(--ink)' }}>{c.seed.title}</Link>
                      <span style={{ font: '500 12px var(--mono)', color: 'var(--magenta)' }}>{c.entry.score.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                <div style={{ paddingTop: 6 }}>
                  {c.results.map((r) => (
                    <Link key={r.film.id} to={`/film/${r.film.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 48 }}>
                      <Thumb film={r.film} w={26} h={38} />
                      <span style={{ flexGrow: 1, minWidth: 0, font: '300 13.5px var(--sans)', color: 'var(--ink-2)' }}>{r.film.title}</span>
                      <span className="meta" style={{ fontSize: 10, color: 'var(--ink-7)' }}>{r.film.year}</span>
                      <span style={{ width: 30, textAlign: 'right', font: '500 12px var(--mono)', color: 'var(--cyan)' }}>{r.match}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
