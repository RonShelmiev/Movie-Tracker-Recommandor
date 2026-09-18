import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalogue } from '../lib/catalogue';
import { Icon } from '../components/Icon';
import { Thumb } from '../components/Poster';
import { StarterBanner } from '../components/StarterBanner';
import { SectionHead } from '../components/ui';
import { formatRuntime } from '../lib/recommend';
import { useStore } from '../lib/store';
import type { Film } from '../lib/types';

export function SearchResults() {
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const { search, candidates, mode, busy, lastError } = useCatalogue();
  const { state } = useStore();
  const lower = q.toLowerCase();
  const [hits, setHits] = useState<Film[]>([]);

  useEffect(() => {
    if (!q) {
      setHits([]);
      return;
    }
    let cancelled = false;
    search(q).then((found) => {
      if (!cancelled) setHits(found);
    });
    return () => {
      cancelled = true;
    };
  }, [q, search]);

  const pool = useMemo(() => {
    const m = new Map<string, Film>();
    for (const f of [...candidates, ...hits]) m.set(f.id, f);
    return [...m.values()];
  }, [candidates, hits]);

  const films = useMemo(() => hits.filter((f) => f.title.toLowerCase().includes(lower)), [hits, lower]);

  const people = useMemo(() => {
    if (!lower) return [];
    const names = new Map<string, number>();
    for (const f of pool) {
      if (f.director.toLowerCase().includes(lower)) names.set(f.director, (names.get(f.director) ?? 0) + 1);
    }
    return [...names.entries()].map(([name, count]) => ({ name, count }));
  }, [lower, pool]);

  const byPerson = useMemo(
    () => (people.length ? pool.filter((f) => people.some((p) => p.name === f.director)).sort((a, b) => b.year - a.year) : []),
    [people, pool],
  );

  const collections = state.collections.filter((c) => c.name.toLowerCase().includes(lower) && lower);

  const scoreOf = (filmId: string) => {
    const entries = state.log.filter((e) => e.filmId === filmId);
    if (!entries.length) return null;
    return entries.reduce((s, e) => s + e.score, 0) / entries.length;
  };
  const listed = new Set(state.watchlist.map((w) => w.filmId));

  const results = [...new Set([...films, ...byPerson])];
  const total = results.length + people.length + collections.length;

  return (
    <div className="screen" style={{ gap: 24 }}>
      <div className="screen-head">
        <div>
          <h1 className="h1">{total} {total === 1 ? 'RESULT' : 'RESULTS'}</h1>
          <div className="meta">
            FOR &ldquo;{q.toUpperCase()}&rdquo; / {people.length} {people.length === 1 ? 'PERSON' : 'PEOPLE'} / {results.length} FILMS / {collections.length} COLLECTIONS
          </div>
        </div>
      </div>

      <StarterBanner />

      {!q && <div className="empty-note">Type something in the search box above.</div>}

      {q && busy && total === 0 && <div className="empty-note">Searching&hellip;</div>}

      {q && !busy && total === 0 && (
        <div className="empty-note">
          Nothing matches &ldquo;{q}&rdquo;.{' '}
          {mode === 'bundled' && (
            <>
              You are on the {candidates.length}-film starter catalogue —{' '}
              <Link to="/settings">add a TMDB key</Link> to search everything.
            </>
          )}
        </div>
      )}

      {lastError && (
        <div className="empty-note" style={{ borderColor: 'rgba(255,77,158,0.3)', color: 'var(--magenta-hi)' }}>
          TMDB request failed: {lastError}
        </div>
      )}

      {people.map((p) => {
        const theirs = pool.filter((f) => f.director === p.name);
        const logged = theirs.filter((f) => state.log.some((e) => e.filmId === f.id));
        const mean = logged.length
          ? logged.reduce((s, f) => s + (scoreOf(f.id) ?? 0), 0) / logged.length
          : null;
        return (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: 20, border: '1px solid rgba(255,77,158,0.24)', background: 'var(--panel)', flexWrap: 'wrap' }}>
            <div style={{ width: 74, height: 74, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'linear-gradient(140deg,#2A0F22,#123145)', border: '1px solid rgba(255,77,158,0.3)', font: '500 22px var(--sans)', letterSpacing: '0.06em', color: 'var(--magenta-hi)' }}>
              {p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </div>
            <div style={{ flexGrow: 1, minWidth: 200 }}>
              <div className="lbl" style={{ color: 'var(--magenta)' }}>Person</div>
              <div style={{ marginTop: 7, font: '600 24px var(--sans)', letterSpacing: '0.03em', color: 'var(--ink-hi)' }}>{p.name}</div>
              <div className="meta" style={{ marginTop: 7 }}>
                DIRECTOR / {theirs.length} IN CATALOGUE / YOU HAVE LOGGED {logged.length}
                {mean !== null && `, MEAN ${mean.toFixed(1)}`}
              </div>
            </div>
          </div>
        );
      })}

      {results.length > 0 && (
        <div>
          <SectionHead title="FILMS" right={<span className="meta" style={{ fontSize: 10, color: 'var(--ink-6)' }}>NEWEST FIRST</span>} />
          <div className="list" style={{ marginTop: 14 }}>
            {results
              .slice()
              .sort((a, b) => b.year - a.year)
              .map((f) => {
                const score = scoreOf(f.id);
                return (
                  <Link key={f.id} to={`/film/${f.id}`} className="list-row" style={{ minHeight: 74 }}>
                    <Thumb film={f} w={44} h={62} />
                    <div style={{ width: 280 }}>
                      <div style={{ font: '500 16px var(--sans)', letterSpacing: '0.03em', color: 'var(--ink-hi)' }}>{f.title}</div>
                      <div className="meta" style={{ marginTop: 5, fontSize: 10 }}>{f.year} / {formatRuntime(f.runtime).toUpperCase()}</div>
                    </div>
                    <span style={{ flexGrow: 1, minWidth: 0, font: '300 13px var(--sans)', color: 'var(--ink-5)' }}>{f.director}</span>
                    <div style={{ width: 110, display: 'flex', justifyContent: 'flex-end' }}>
                      {score !== null ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Icon name="seen" size={14} width={1.9} colour="var(--cyan)" />
                          <span style={{ font: '500 13px var(--mono)', color: 'var(--cyan)' }}>{score.toFixed(1)}</span>
                        </span>
                      ) : listed.has(f.id) ? (
                        <span style={{ font: '400 11px var(--mono)', letterSpacing: '0.1em', color: 'var(--magenta)' }}>ON LIST</span>
                      ) : (
                        <span style={{ font: '400 11px var(--mono)', letterSpacing: '0.1em', color: 'var(--ink-8)' }}>NOT SEEN</span>
                      )}
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      )}

      {collections.length > 0 && (
        <div>
          <SectionHead title="COLLECTIONS" />
          <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {collections.map((c) => (
              <Link key={c.id} to={`/browse?collection=${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', border: '1px solid var(--edge)', background: 'rgba(9,14,22,0.5)' }}>
                <span style={{ width: 5, height: 5, background: c.colour }} />
                <span style={{ font: '400 14px var(--sans)', color: 'var(--ink-2)' }}>{c.name}</span>
                <span className="meta" style={{ fontSize: 10, color: 'var(--ink-7)' }}>{c.filmIds.length} FILMS</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
