import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogue } from '../lib/catalogue';
import { Icon } from '../components/Icon';
import { Thumb } from '../components/Poster';
import { posterUrl } from '../lib/tmdb';
import { Chip, SectionHead } from '../components/ui';
import { buildTaste, focusIsActive, formatRuntime, recommend, seedClusters } from '../lib/recommend';
import type { Focus } from '../lib/recommend';
import { useStore } from '../lib/store';
import type { Tag } from '../lib/types';

/** Readable names for the tags that can be steered by. */
const MOOD_LABEL: Partial<Record<Tag, string>> = {
  cerebral: 'Cerebral',
  slow: 'Slow',
  bleak: 'Bleak',
  'noir-lighting': 'Noir',
  rain: 'Rain',
  'city-at-night': 'Night city',
  space: 'Space',
  ai: 'Artificial minds',
  memory: 'Memory',
  'time-loop': 'Time loops',
  surveillance: 'Surveillance',
  dystopia: 'Dystopia',
  'body-horror': 'Body horror',
  arthouse: 'Arthouse',
  desert: 'Desert',
  procedural: 'Procedural',
  anime: 'Animation',
  grief: 'Grief',
  satire: 'Satire',
  twist: 'Twists',
  stylish: 'Style',
  ensemble: 'Ensemble',
  'practical-fx': 'Practical effects',
  'one-location': 'One location',
};

const LENGTHS: { label: string; minutes: number | null }[] = [
  { label: 'Any length', minutes: null },
  { label: 'Under 90m', minutes: 90 },
  { label: 'Under 2h', minutes: 120 },
  { label: 'Under 3h', minutes: 180 },
];

export function ForYou() {
  const { candidates, getFilm } = useCatalogue();
  const { state, dispatch } = useStore();
  const [focus, setFocus] = useState<Focus>({});

  const taste = useMemo(() => buildTaste(state.log, getFilm), [state.log, getFilm]);

  /** Your best-rated films, as things to say "more like this" about. */
  const seedChoices = useMemo(
    () =>
      [...state.log]
        .sort((a, b) => b.score - a.score)
        .map((e) => ({ e, f: getFilm(e.filmId) }))
        .filter((x): x is { e: typeof x.e; f: NonNullable<typeof x.f> } => Boolean(x.f))
        .filter((x, i, all) => all.findIndex((y) => y.f.id === x.f.id) === i)
        .slice(0, 8),
    [state.log, getFilm],
  );

  /**
   * The moods your scores lean toward, strongest first — topped up with the
   * ones that simply recur in your library. Rating everything the same leaves
   * every tag at zero lift, and the row would otherwise disappear exactly
   * when someone has plenty logged.
   */
  const moods = useMemo(() => {
    const picked: Tag[] = [...taste.tag.entries()]
      .filter(([t, v]) => MOOD_LABEL[t] && v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);

    if (picked.length < 8) {
      const seen = new Set(picked);
      const counts = new Map<Tag, number>();
      for (const e of state.log) {
        const f = getFilm(e.filmId);
        if (!f) continue;
        for (const t of f.tags) if (MOOD_LABEL[t] && !seen.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      picked.push(
        ...[...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([t]) => t),
      );
    }
    return picked.slice(0, 8);
  }, [taste, state.log, getFilm]);

  const recs = useMemo(
    () => recommend(state, candidates, getFilm, 24, focus),
    [state, candidates, getFilm, focus],
  );
  const clusters = useMemo(() => seedClusters(recs, state, getFilm), [recs, state, getFilm]);

  const top = recs.slice(0, 3);
  const rest = recs.slice(3, 15);
  const active = focusIsActive(focus);

  const toggleSeed = (id: string) =>
    setFocus((f) => {
      const cur = f.seedIds ?? [];
      return { ...f, seedIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });

  const toggleTag = (t: Tag) =>
    setFocus((f) => {
      const cur = f.tags ?? [];
      return { ...f, tags: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] };
    });

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
    <div className="screen" style={{ gap: 22 }}>
      <div className="screen-head">
        <div>
          <h1 className="h1">FOR YOU</h1>
          <div className="meta">
            FROM {state.log.length} LOGGED {state.log.length === 1 ? 'FILM' : 'FILMS'} /{' '}
            {recs.length} {recs.length === 1 ? 'MATCH' : 'MATCHES'}
          </div>
        </div>
        <Link to="/settings" className="btn btn-sm">
          <Icon name="filters" size={15} width={1.6} />
          TUNE MY TASTE
        </Link>
      </div>

      {/* Tune My Taste holds the standing profile. These steer tonight only,
          and are deliberately not saved. */}
      <div className="focus-panel">
        <div className="focus-row">
          <span className="lbl focus-lbl">Tonight</span>
          <div className="filter-row">
            {LENGTHS.map((l) => (
              <Chip
                key={l.label}
                label={l.label}
                on={(focus.maxRuntime ?? null) === l.minutes}
                onClick={() => setFocus((f) => ({ ...f, maxRuntime: l.minutes }))}
              />
            ))}
          </div>
        </div>

        {seedChoices.length > 0 && (
          <div className="focus-row">
            <span className="lbl focus-lbl">More like</span>
            <div className="filter-row">
              {seedChoices.map(({ f, e }) => (
                <Chip
                  key={f.id}
                  label={`${f.title} ${e.score.toFixed(1)}`}
                  on={(focus.seedIds ?? []).includes(f.id)}
                  onClick={() => toggleSeed(f.id)}
                />
              ))}
            </div>
          </div>
        )}

        {moods.length > 0 && (
          <div className="focus-row">
            <span className="lbl focus-lbl">In the mood for</span>
            <div className="filter-row">
              {moods.map((t) => (
                <Chip
                  key={t}
                  label={MOOD_LABEL[t] ?? t}
                  on={(focus.tags ?? []).includes(t)}
                  onClick={() => toggleTag(t)}
                />
              ))}
            </div>
          </div>
        )}

        {active && (
          <button type="button" className="btn btn-sm btn-ghost focus-clear" onClick={() => setFocus({})}>
            CLEAR — BACK TO MY WHOLE TASTE
          </button>
        )}
      </div>

      {top.length === 0 ? (
        <div className="empty-note">
          {active ? (
            <>Nothing matches that combination. <button type="button" className="link-btn" onClick={() => setFocus({})}>Clear it</button> and try fewer.</>
          ) : (
            <>Your hard rules have filtered everything out. <Link to="/settings">Loosen them</Link>.</>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {top.map((rec) => (
            <article key={rec.film.id} className="panel rec-card">
              <div className={`rec-art art-${rec.film.art}`} aria-hidden="true">
                {rec.film.posterPath && <img className="art-img" src={posterUrl(rec.film.posterPath, 'w342')} alt="" />}
              </div>
              <div style={{ flexGrow: 1, minWidth: 0, padding: 18, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ font: '500 24px var(--sans)', color: 'var(--cyan)' }}>{rec.match}</span>
                  <span className="lbl" style={{ color: 'var(--cyan)' }}>% match</span>
                </div>
                <Link to={`/film/${rec.film.id}`} className="rec-title">{rec.film.title.toUpperCase()}</Link>
                <div className="meta" style={{ marginTop: 7, fontSize: 10 }}>
                  {rec.film.year} / {rec.film.director.toUpperCase()} / {formatRuntime(rec.film.runtime).toUpperCase()}
                </div>
                <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[rec.seedReason, ...rec.reasons].filter(Boolean).slice(0, 3).map((r) => (
                    <li key={r} style={{ display: 'flex', gap: 9, font: '300 12.5px var(--sans)', lineHeight: 1.5, color: 'var(--ink-3)' }}>
                      <span style={{ marginTop: 6, width: 4, height: 4, flexShrink: 0, background: 'var(--magenta)' }} />
                      {r}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ justifyContent: 'center' }}
                    onClick={() => dispatch({ type: 'watchlist/add', filmId: rec.film.id, source: rec.seedReason ?? rec.reasons[0] ?? 'Recommended for you' })}
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

      {/* Three cards used to be the whole page; the rest of the ranking was
          computed and thrown away. */}
      {rest.length > 0 && (
        <div>
          <SectionHead
            title="NEXT BEST"
            right={<span className="meta" style={{ fontSize: 10, color: 'var(--ink-6)' }}>{rest.length} MORE</span>}
          />
          <div style={{ marginTop: 12 }}>
            {rest.map((r) => (
              <div key={r.film.id} className="log-row">
                <span className="log-art">
                  <Thumb film={r.film} w={34} h={48} />
                </span>
                <div className="log-main">
                  <Link to={`/film/${r.film.id}`} className="log-title">{r.film.title}</Link>
                  <div className="meta log-sub">
                    {r.film.year} / {formatRuntime(r.film.runtime).toUpperCase()}
                  </div>
                </div>
                <span className="log-kind meta" style={{ color: 'var(--ink-7)' }}>
                  {r.reasons[0] ?? ''}
                </span>
                <button
                  type="button"
                  className="score-edit"
                  onClick={() => dispatch({ type: 'watchlist/add', filmId: r.film.id, source: r.reasons[0] ?? 'Recommended for you' })}
                  aria-label={`Add ${r.film.title} to your To See list`}
                >
                  <span style={{ width: 34, textAlign: 'right', font: '500 14px var(--mono)', color: 'var(--cyan)' }}>
                    {r.match}
                  </span>
                  <Icon name="tosee" size={14} width={1.8} colour="var(--ink-5)" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {clusters.length > 0 && (
        <div>
          <SectionHead title="WHERE THESE CAME FROM" />
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {clusters.map((c) => (
              <div key={c.seed.id} style={{ border: '1px solid var(--edge)', background: 'rgba(9,14,22,0.45)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: '1px solid var(--hairline)' }}>
                  <Thumb film={c.seed} w={34} h={48} />
                  <div style={{ minWidth: 0 }}>
                    <div className="lbl" style={{ fontSize: 9 }}>Because you rated</div>
                    <div style={{ marginTop: 5, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <Link to={`/film/${c.seed.id}`} style={{ font: '500 15px var(--sans)', color: 'var(--ink)' }}>{c.seed.title}</Link>
                      <span style={{ font: '500 12px var(--mono)', color: 'var(--magenta)' }}>{c.entry.score.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                <div style={{ paddingTop: 4 }}>
                  {c.results.map((r) => (
                    <Link key={r.film.id} to={`/film/${r.film.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 46 }}>
                      <Thumb film={r.film} w={26} h={38} />
                      <span style={{ flexGrow: 1, minWidth: 0, font: '300 13px var(--sans)', color: 'var(--ink-2)' }}>{r.film.title}</span>
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
