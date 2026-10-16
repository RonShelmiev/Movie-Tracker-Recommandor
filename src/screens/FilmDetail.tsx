import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCatalogue } from '../lib/catalogue';
import { useLogModal } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { Poster } from '../components/Poster';
import { SectionHead, Stars } from '../components/ui';
import { crowdRating, formatRuntime, matchContext, scoreFilm } from '../lib/recommend';
import { posterUrl } from '../lib/tmdb';
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
    // Ties break on year, not acclaim: "more like this" should not quietly
    // rank by what everyone else thought.
    .sort((a, b) => b.n - a.n || b.f.year - a.f.year)
    .slice(0, limit)
    .map((x) => x.f);
}

export function FilmDetail() {
  const { id } = useParams();
  const { candidates, getFilm, load } = useCatalogue();
  const { state, dispatch } = useStore();
  const { openLog, editLog } = useLogModal();
  const film = id ? getFilm(id) : undefined;

  // A TMDB film nobody has searched for on this device is not cached yet.
  // Ask for it rather than declaring it missing.
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id || film) return;
    let live = true;
    setLoading(true);
    void load(id).finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [id, film, load]);

  if (!film) {
    return (
      <div className="screen">
        <div className="empty-note">
          {loading ? 'Fetching that film from TMDB…' : <>That film is not in the catalogue. <Link to="/browse">Browse everything</Link>.</>}
        </div>
      </div>
    );
  }

  const entries = state.log.filter((e) => e.filmId === film.id).sort((a, b) => b.watchedOn.localeCompare(a.watchedOn));
  const listed = state.watchlist.some((w) => w.filmId === film.id);
  const myScore = entries.length ? entries.reduce((s, e) => s + e.score, 0) / entries.length : null;
  // Independent of whether the engine would *offer* this film — seen, listed
  // and over-the-ceiling titles all still have an honest fit.
  const ctx = matchContext(state, getFilm);
  const taste = ctx.taste;
  const score = scoreFilm(state, film, getFilm, ctx);
  const dir = taste.director.get(film.director);
  const seen = new Set(state.log.map((e) => e.filmId));
  const listedIds = new Set(state.watchlist.map((w) => w.filmId));
  const art = posterUrl(film.posterPath, 'w500');
  const crowd = crowdRating(film);
  // A match is a guess at whether you would like it. Once you have rated it
  // the guess is beside the point, and showing one next to your own score
  // read as the app disagreeing with you: 2049 at "53%" beside Ron's 9.4.
  const showMatch = myScore === null;
  const tiles = 1 + (showMatch ? 1 : 0) + (crowd ? 1 : 0);

  const overlapNotes: string[] = [];
  if (dir && dir.n > 1) overlapNotes.push(`You rate ${film.director} ${dir.mean.toFixed(1)} across ${dir.n} films`);
  const topGenre = [...taste.genre.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topGenre && film.genres.includes(topGenre[0])) overlapNotes.push(`${topGenre[0]} is your strongest genre`);
  const strongTag = film.tags.find((t) => (taste.tag.get(t) ?? 0) > 0.5);
  if (strongTag) overlapNotes.push(`Tagged “${strongTag}”, which runs high in your log`);

  return (
    <div className="film-page">
      {/* On a phone the poster is the header, the way Letterboxd leads with
          its art: sharp, full width, the top half showing before it fades
          into the page under the title. On a wide screen it would be cropped
          to a sliver, so there it is blurred into a backdrop beside a poster
          card instead. The art-* skin sits on its own layer and only shows
          when there is no artwork — on the section itself, its motif drew a
          line through the title. */}
      <section className={art ? 'film-hero has-art' : 'film-hero'}>
        <div className={`film-backdrop art-${film.art}`} aria-hidden="true">
          {art && <img src={art} alt="" />}
        </div>
        <div className="film-veil" aria-hidden="true" />

        <div className="film-hero-inner">
          <Link to="/browse" className="film-back">
            <Icon name="chevron-left" size={15} width={1.8} />
            <span>BROWSE ALL</span>
          </Link>

          <div className="film-head">
            <div className={`film-poster art-${film.art}`}>
              {art && <img className="art-img" src={art} alt={`${film.title} poster`} />}
            </div>
            <div className="film-titles">
              <div className="lbl film-kicker">{film.genres.join(' / ') || 'Film'}</div>
              <h1>{film.title}</h1>
              <div className="film-meta">
                <span>{film.year}</span>
                <span>{formatRuntime(film.runtime)}</span>
                <span>{film.country}</span>
              </div>
              <div className="film-director">
                Directed by <b>{film.director}</b>
              </div>
            </div>
          </div>

          <div className="film-actions">
            <button type="button" className="btn btn-primary" onClick={() => openLog(film.id)}>
              <Icon name="check" size={15} width={2.2} colour="var(--void)" />
              {entries.length ? `SEEN · ${entries.length}×` : 'MARK SEEN'}
            </button>
            {listed ? (
              <button type="button" className="btn btn-on" onClick={() => dispatch({ type: 'watchlist/remove', filmId: film.id })}>
                <Icon name="tosee" size={15} width={1.6} />
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
      </section>

      {/* Your verdict, the engine's guess (only until you have one of your
          own), and IMDb's. */}
      <section className={`film-scores tiles-${tiles}`}>
        <div className="score-tile">
          <div className="lbl">Your score</div>
          {myScore !== null ? (
            <>
              <div className="score-big">{myScore.toFixed(1)}</div>
              <Stars score={myScore} />
            </>
          ) : (
            <>
              <div className="score-big is-empty">—</div>
              <button type="button" className="link-btn score-cta" onClick={() => openLog(film.id)}>Rate it</button>
            </>
          )}
        </div>

        {showMatch && (
          <div className="score-tile is-for-you">
            <div className="lbl">Match for you</div>
            {score ? (
              <>
                <div className="score-big">
                  {score.match}
                  <small>%</small>
                </div>
                <div className="fit-bar" aria-hidden="true">
                  <i style={{ width: `${score.match}%` }} />
                </div>
              </>
            ) : (
              <>
                <div className="score-big is-empty">—</div>
                <div className="score-note">Log three films to see a match</div>
              </>
            )}
          </div>
        )}

        {crowd && (
          <div className="score-tile is-crowd">
            <div className="lbl">{crowd.source}</div>
            <div className="score-big is-dim">
              {crowd.value.toFixed(1)}
              <small>/10</small>
            </div>
            <div className="score-note">
              {crowd.votes >= 1_000_000
                ? `${(crowd.votes / 1_000_000).toFixed(1)}M votes`
                : crowd.votes >= 1000
                  ? `${Math.round(crowd.votes / 1000)}K votes`
                  : crowd.votes > 0
                    ? `${crowd.votes} votes`
                    : 'Average rating'}
            </div>
          </div>
        )}
      </section>

      <div className="screen split film-body">
        <div>
          <div className="lbl">Synopsis</div>
          <p style={{ marginTop: 12, maxWidth: 660, font: '300 15px var(--sans)', lineHeight: 1.7, color: 'var(--ink-2)', textWrap: 'pretty' }}>
            {film.synopsis}
          </p>

          {/* Director and country moved up into the header, where Letterboxd
              puts them; only the tags are left down here. */}
          <div className="info-grid" style={{ marginTop: 30 }}>
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
            <div className="grid-posters" style={{ marginTop: 14 }}>
              {similar(film, candidates).map((f) => (
                <Poster key={f.id} film={f} status={seen.has(f.id) ? 'seen' : listedIds.has(f.id) ? 'listed' : null} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div className="panel" style={{ padding: 20 }}>
            <span className="h3">YOUR LOG</span>
            {entries.length > 0 && (
              <div className="meta" style={{ marginTop: 10, fontSize: 9.5, color: 'var(--ink-8)' }}>
                TAP AN ENTRY TO CHANGE THE SCORE, DATE OR NOTE
              </div>
            )}
            {entries.length === 0 ? (
              <div style={{ marginTop: 14, font: '300 13.5px var(--sans)', color: 'var(--ink-5)' }}>
                You have not logged this yet.
              </div>
            ) : (
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {entries.map((e, i) => (
                  <div key={e.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        className="log-entry"
                        onClick={() => editLog(e)}
                        aria-label={`Edit entry from ${e.watchedOn}`}
                      >
                        <span style={{ width: 6, height: 6, flexShrink: 0, background: i === 0 ? 'var(--cyan)' : 'rgba(126,214,232,0.35)' }} />
                        <span style={{ flexGrow: 1, minWidth: 0, font: '300 13.5px var(--sans)', color: 'var(--ink-2)' }}>
                          {new Date(e.watchedOn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="meta" style={{ fontSize: 10, color: 'var(--ink-6)' }}>{e.rewatch ? 'REWATCH' : 'FIRST'}</span>
                        <span style={{ font: '500 15px var(--mono)', color: 'var(--cyan)' }}>{e.score.toFixed(1)}</span>
                        <Icon name="pencil" size={14} width={1.6} colour="var(--ink-6)" />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Remove this entry"
                        onClick={() => dispatch({ type: 'unlog', id: e.id })}
                      >
                        <Icon name="close" size={14} width={1.8} colour="var(--ink-7)" />
                      </button>
                    </div>
                    {e.note && (
                      <div style={{ marginTop: 8, paddingLeft: 16, font: '300 13px var(--sans)', lineHeight: 1.6, color: 'var(--ink-4)' }}>
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
