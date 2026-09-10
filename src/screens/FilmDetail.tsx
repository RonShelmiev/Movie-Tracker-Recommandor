import { Link, useParams } from 'react-router-dom';
import { useCatalogue } from '../lib/catalogue';
import { useLogModal } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { Poster } from '../components/Poster';
import { SectionHead } from '../components/ui';
import { buildTaste, formatRuntime } from '../lib/recommend';
import { useStore } from '../lib/store';
import type { Film } from '../lib/types';

function similar(film: Film, pool: Film[], limit = 5): Film[] {
  const mine = new Set<string>([...film.tags, ...film.genres]);
  return pool.filter((f) => f.id !== film.id)
    .map((f) => {
      let n = 0;
      for (const t of [...f.tags, ...f.genres]) if (mine.has(t)) n += 1;
      if (f.director === film.director) n += 2;
      return { f, n };
    })
    .filter((x) => x.n >= 3)
    .sort((a, b) => b.n - a.n || b.f.acclaim - a.f.acclaim)
    .slice(0, limit)
    .map((x) => x.f);
}

export function FilmDetail() {
  const { id } = useParams();
  const { candidates, getFilm } = useCatalogue();
  const { state, dispatch } = useStore();
  const { openLog } = useLogModal();
  const film = id ? getFilm(id) : undefined;

  if (!film) {
    return (
      <div className="screen">
        <div className="empty-note">That film is not in the catalogue. <Link to="/browse">Browse everything</Link>.</div>
      </div>
    );
  }

  const entries = state.log.filter((e) => e.filmId === film.id).sort((a, b) => b.watchedOn.localeCompare(a.watchedOn));
  const listed = state.watchlist.some((w) => w.filmId === film.id);
  const myScore = entries.length ? entries.reduce((s, e) => s + e.score, 0) / entries.length : null;
  const taste = buildTaste(state.log, getFilm);
  const dir = taste.director.get(film.director);
  const seen = new Set(state.log.map((e) => e.filmId));
  const listedIds = new Set(state.watchlist.map((w) => w.filmId));

  const overlapNotes: string[] = [];
  if (dir && dir.n > 1) overlapNotes.push(`You rate ${film.director} ${dir.mean.toFixed(1)} across ${dir.n} films`);
  const topGenre = [...taste.genre.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topGenre && film.genres.includes(topGenre[0])) overlapNotes.push(`${topGenre[0]} is your strongest genre`);
  const strongTag = film.tags.find((t) => (taste.tag.get(t) ?? 0) > 0.5);
  if (strongTag) overlapNotes.push(`Tagged “${strongTag}”, which runs high in your log`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <section className={`keyart art-${film.art}`}>
        <div className="glow-a" />
        <div className="glow-b" />
        <div className="veil" />
        <div className="inner">
          <Link to="/browse" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--ink-3)' }}>
            <Icon name="chevron-left" size={15} width={1.8} />
            <span style={{ font: '400 12px var(--sans)', letterSpacing: '0.14em' }}>BROWSE ALL</span>
          </Link>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ flexGrow: 1, minWidth: 280 }}>
              <h1>{film.title.toUpperCase()}</h1>
              <div className="meta" style={{ marginTop: 14, color: 'var(--ink-2)' }}>
                {film.year} &nbsp;/&nbsp; {film.director.toUpperCase()} &nbsp;/&nbsp; {formatRuntime(film.runtime).toUpperCase()} &nbsp;/&nbsp; {film.genres.join(', ').toUpperCase()} &nbsp;/&nbsp; {film.country.toUpperCase()}
              </div>

              <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" onClick={() => openLog(film.id)}>
                  <Icon name="check" size={15} width={2.2} colour="var(--void)" />
                  {entries.length ? `SEEN · ${entries.length} ${entries.length === 1 ? 'TIME' : 'TIMES'}` : 'MARK SEEN'}
                </button>
                {listed ? (
                  <button type="button" className="btn" onClick={() => dispatch({ type: 'watchlist/remove', filmId: film.id })}>
                    <Icon name="close" size={15} width={1.8} />
                    ON YOUR LIST
                  </button>
                ) : (
                  <button type="button" className="btn" onClick={() => dispatch({ type: 'watchlist/add', filmId: film.id, source: 'You added it' })}>
                    <Icon name="tosee" size={15} width={1.6} />
                    ADD TO SEE
                  </button>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div className="lbl" style={{ color: 'var(--ink-4)' }}>{myScore !== null ? 'Your score' : 'Not yet rated'}</div>
              <div className="score-hero">{myScore !== null ? myScore.toFixed(1) : '—'}</div>
              <div className="score-ticks" style={{ marginTop: 12 }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <i key={i} className={myScore !== null && i < Math.round(myScore) ? 'on' : undefined} />
                ))}
              </div>
              <div className="meta" style={{ marginTop: 12, color: 'var(--ink-6)', fontSize: 10 }}>
                ACCLAIM {(film.acclaim / 10).toFixed(1)} / {film.ratingsK}K RATINGS
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="screen split" style={{ paddingTop: 32 }}>
        <div>
          <div className="lbl">Synopsis</div>
          <p style={{ marginTop: 12, maxWidth: 660, font: '300 15px var(--sans)', lineHeight: 1.7, color: 'var(--ink-2)', textWrap: 'pretty' }}>
            {film.synopsis}
          </p>

          <div className="info-grid" style={{ marginTop: 30 }}>
            <div>
              <div className="lbl">Director</div>
              <div style={{ marginTop: 8, font: '400 14.5px var(--sans)', color: 'var(--ink)' }}>{film.director}</div>
            </div>
            <div>
              <div className="lbl">Country</div>
              <div style={{ marginTop: 8, font: '400 14.5px var(--sans)', color: 'var(--ink)' }}>{film.country}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="lbl">Tags</div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {film.tags.map((t) => (
                  <span key={t} className="chip" style={{ pointerEvents: 'none' }}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 34 }}>
            <SectionHead title="MORE LIKE THIS" />
            <div className="grid-posters" style={{ marginTop: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
              {similar(film, candidates).map((f) => (
                <Poster key={f.id} film={f} status={seen.has(f.id) ? 'seen' : listedIds.has(f.id) ? 'listed' : null} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div className="panel" style={{ padding: 20 }}>
            <span className="h3">YOUR LOG</span>
            {entries.length === 0 ? (
              <div style={{ marginTop: 14, font: '300 13.5px var(--sans)', color: 'var(--ink-5)' }}>
                You have not logged this yet.
              </div>
            ) : (
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {entries.map((e, i) => (
                  <div key={e.watchedOn + i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 6, height: 6, background: i === 0 ? 'var(--cyan)' : 'rgba(126,214,232,0.35)' }} />
                      <span style={{ flexGrow: 1, font: '300 13.5px var(--sans)', color: 'var(--ink-2)' }}>
                        {new Date(e.watchedOn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="meta" style={{ fontSize: 10, color: 'var(--ink-6)' }}>{e.rewatch ? 'REWATCH' : 'FIRST'}</span>
                      <span style={{ font: '500 13px var(--mono)', color: 'var(--cyan)' }}>{e.score.toFixed(1)}</span>
                      <button type="button" aria-label="Remove this entry" onClick={() => dispatch({ type: 'unlog', filmId: film.id, watchedOn: e.watchedOn })}>
                        <Icon name="close" size={13} width={1.8} colour="var(--ink-7)" />
                      </button>
                    </div>
                    {e.note && (
                      <div style={{ marginTop: 8, paddingLeft: 18, font: '300 13px var(--sans)', lineHeight: 1.6, color: 'var(--ink-4)' }}>
                        {e.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {overlapNotes.length > 0 && (
            <div className="panel" style={{ padding: 20 }}>
              <span className="h3">WHY IT FITS YOU</span>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {overlapNotes.map((n) => (
                  <div key={n} style={{ display: 'flex', gap: 10 }}>
                    <span style={{ marginTop: 7, width: 4, height: 4, flexShrink: 0, background: 'var(--magenta)' }} />
                    <span style={{ font: '300 13px var(--sans)', lineHeight: 1.5, color: 'var(--ink-3)' }}>{n}</span>
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
