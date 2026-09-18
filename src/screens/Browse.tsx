import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCatalogue } from '../lib/catalogue';
import { Poster } from '../components/Poster';
import { StarterBanner } from '../components/StarterBanner';
import { Chip } from '../components/ui';
import { useStore } from '../lib/store';
import type { Genre } from '../lib/types';

const GENRES: Genre[] = ['Sci-fi', 'Neo-noir', 'Drama', 'Thriller', 'Crime', 'Animation', 'Horror', 'Action', 'Mystery'];
const DECADES = [1920, 1940, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
type Sort = 'title' | 'year' | 'acclaim';

export function Browse() {
  const { candidates } = useCatalogue();
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const [genre, setGenre] = useState<Genre | null>(null);
  const [decade, setDecade] = useState<number | null>(null);
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('title');

  const collectionId = params.get('collection');
  const collection = state.collections.find((c) => c.id === collectionId) ?? null;

  const seen = useMemo(() => new Set(state.log.map((e) => e.filmId)), [state.log]);
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
          : b.acclaim - a.acclaim,
    );
    return out;
  }, [collection, genre, decade, unseenOnly, sort, seen]);

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
            <Poster key={f.id} film={f} status={seen.has(f.id) ? 'seen' : listed.has(f.id) ? 'listed' : null} />
          ))}
        </div>
      )}
    </div>
  );
}
