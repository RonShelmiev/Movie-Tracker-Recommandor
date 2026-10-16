import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCatalogue } from '../lib/catalogue';
import { Poster } from '../components/Poster';
import { StarterBanner } from '../components/StarterBanner';
import { Chip } from '../components/ui';
import { matchContext, matchIsMeaningful, scoreFilm } from '../lib/recommend';
import { useStore } from '../lib/store';
import type { Genre } from '../lib/types';

const GENRES: Genre[] = ['Sci-fi', 'Neo-noir', 'Drama', 'Thriller', 'Crime', 'Animation', 'Horror', 'Action', 'Mystery'];
const DECADES = [1920, 1940, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
type Sort = 'title' | 'year' | 'acclaim' | 'match';

export function Browse() {
  const { candidates, getFilm } = useCatalogue();
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const [genre, setGenre] = useState<Genre | null>(null);
  const [decade, setDecade] = useState<number | null>(null);
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('title');

  const collectionId = params.get('collection');
  const collection = state.collections.find((c) => c.id === collectionId) ?? null;

  // Built once for the whole grid rather than once per poster.
  const ctx = useMemo(() => matchContext(state, getFilm), [state, getFilm]);
  const showMatch = matchIsMeaningful(ctx.taste);
  const matches = useMemo(() => {
    const m = new Map<string, number>();
    if (!showMatch) return m;
    for (const f of candidates) {
      const s = scoreFilm(state, f, getFilm, ctx);
      if (s) m.set(f.id, s.match);
    }
    return m;
  }, [candidates, state, getFilm, ctx, showMatch]);

  const seen = useMemo(() => new Set(state.log.map((e) => e.filmId)), [state.log]);
  // Your latest score for each film you have rated. A rated film shows that
  // rather than a match: the engine guessing at a film you already scored
  // read as the app disagreeing with you (2049 at "53%" beside a 9.4).
  const mine = useMemo(() => {
    const m = new Map<string, { score: number; on: string }>();
    for (const e of state.log) {
      const prev = m.get(e.filmId);
      if (!prev || e.watchedOn > prev.on) m.set(e.filmId, { score: e.score, on: e.watchedOn });
    }
    return m;
  }, [state.log]);
  const listed = useMemo(() => new Set(state.watchlist.map((w) => w.filmId)), [state.watchlist]);

  const films = useMemo(() => {
    let out = candidates.slice();
    if (collection) out = out.filter((f) => collection.filmIds.includes(f.id));
    if (genre) out = out.filter((f) => f.genres.includes(genre));
    if (decade !== null) out = out.filter((f) => Math.floor(f.year / 10) * 10 === decade);
    if (unseenOnly) out = out.filter((f) => !seen.has(f.id));
    out.sort((a, b) =>
      sort === 'title'
        ? a.title.localeCompare(b.title)
        : sort === 'year'
          ? b.year - a.year
          : sort === 'match'
            ? (matches.get(b.id) ?? -1) - (matches.get(a.id) ?? -1) || a.title.localeCompare(b.title)
            : b.acclaim - a.acclaim,
    );
    return out;
  }, [collection, genre, decade, unseenOnly, sort, seen, matches]);

  return (
    <div className="screen" style={{ gap: 22 }}>
      <StarterBanner />

      <div className="screen-head">
        <div>
          <h1 className="h1">{collection ? collection.name.toUpperCase() : 'BROWSE ALL'}</h1>
          <div className="meta">
            {candidates.length} TITLES INDEXED / {films.length} SHOWN
            {collection && ' / COLLECTION'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="lbl">Sort</span>
          <select
            className="chip"
            value={sort}
            aria-label="Sort"
            onChange={(e) => setSort(e.target.value as Sort)}
            style={{ appearance: 'none', paddingRight: 30, background: 'transparent' }}
          >
            <option value="title">TITLE A-Z</option>
            <option value="year">NEWEST FIRST</option>
            <option value="acclaim">MOST ACCLAIMED</option>
            {showMatch && <option value="match">BEST MATCH</option>}
          </select>
        </div>
      </div>

      {/* Two rows rather than one flat list: on a phone these wrap into seven
          rows and push every film below the fold, so each row scrolls
          sideways instead (see .filter-row in layout.css). */}
      <div className="filter-rows">
        <div className="filter-row">
          <Chip label="ALL" on={!genre && decade === null && !unseenOnly && !collection} onClick={() => { setGenre(null); setDecade(null); setUnseenOnly(false); setParams({}); }} />
          {GENRES.map((g) => (
            <Chip key={g} label={g} on={genre === g} onClick={() => setGenre(genre === g ? null : g)} />
          ))}
        </div>
        <div className="filter-row">
          {DECADES.map((d) => (
            <Chip key={d} label={`${d}s`} on={decade === d} onClick={() => setDecade(decade === d ? null : d)} />
          ))}
          <Chip label="Unseen only" on={unseenOnly} onClick={() => setUnseenOnly(!unseenOnly)} />
        </div>
      </div>

      {films.length === 0 ? (
        <div className="empty-note">Nothing matches those filters.</div>
      ) : (
        <div className="grid-posters">
          {films.map((f) => (
            <Poster
              key={f.id}
              film={f}
              status={seen.has(f.id) ? 'seen' : listed.has(f.id) ? 'listed' : null}
              match={matches.get(f.id) ?? null}
              mine={mine.get(f.id)?.score ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
