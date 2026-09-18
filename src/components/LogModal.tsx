import { useEffect, useMemo, useState } from 'react';
import { useCatalogue } from '../lib/catalogue';
import { newId, useStore } from '../lib/store';
import type { Film, LogEntry } from '../lib/types';
import { Icon } from './Icon';
import { Thumb } from './Poster';

const todayISO = () => new Date().toISOString().slice(0, 10);
const shiftISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function LogModal({
  filmId,
  editing,
  onClose,
}: {
  filmId: string | null;
  editing?: LogEntry;
  onClose: () => void;
}) {
  const { getFilm, search, mode, busy } = useCatalogue();
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Film[]>([]);
  const [picked, setPicked] = useState<Film | null>(
    editing ? getFilm(editing.filmId) ?? null : filmId ? getFilm(filmId) ?? null : null,
  );
  const [watchedOn, setWatchedOn] = useState(editing?.watchedOn ?? todayISO());
  const [rewatch, setRewatch] = useState(editing?.rewatch ?? false);
  const [score, setScore] = useState(editing ? Math.round(editing.score * 10) : 75);
  const [note, setNote] = useState(editing?.note ?? '');
  const [collections, setCollections] = useState<string[]>([]);
  /* Removing a watch cannot be undone, so it takes two taps rather than a
     confirm dialog — which on a phone lands under your thumb mid-scroll. */
  const [armed, setArmed] = useState(false);

  const alreadySeen = useMemo(
    () => (picked ? state.log.some((e) => e.filmId === picked.id) : false),
    [picked, state.log],
  );

  // Only infer "rewatch" for a brand new entry; an edit keeps what was saved.
  useEffect(() => {
    if (!editing) setRewatch(alreadySeen);
  }, [alreadySeen, editing]);

  // Never leave the delete armed: step away and it goes back to safe.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Debounced so typing does not fire a request per keystroke against TMDB.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      search(q).then((found) => {
        if (!cancelled) setMatches(found.slice(0, 6));
      });
    }, mode === 'tmdb' ? 350 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, search, mode]);

  function save() {
    if (!picked) return;
    const entry: LogEntry = {
      id: editing?.id ?? newId(),
      filmId: picked.id,
      watchedOn,
      rewatch,
      score: Math.round(score) / 10,
      note: note.trim() || undefined,
    };
    if (editing) dispatch({ type: 'editLog', entry });
    else dispatch({ type: 'log', entry, collections });
    onClose();
  }

  function remove() {
    if (!editing) return;
    dispatch({ type: 'unlog', id: editing.id });
    onClose();
  }

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Log a film" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 7, height: 7, background: 'var(--cyan)', boxShadow: '0 0 10px rgba(78,226,242,0.9)' }} />
            <span style={{ font: "600 16px var(--sans)", letterSpacing: '0.2em', color: 'var(--ink-hi)' }}>
            {editing ? 'EDIT ENTRY' : 'LOG A FILM'}
          </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <Icon name="close" size={17} width={1.8} colour="var(--ink-5)" />
          </button>
        </div>

        <div className="modal-body">
          <div>
            <div className="lbl">Which film</div>
            {picked ? (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid var(--cyan)', background: 'rgba(78,226,242,0.06)' }}>
                <Thumb film={picked} w={44} h={62} />
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ font: '600 18px var(--sans)', letterSpacing: '0.03em', color: 'var(--ink-hi)' }}>{picked.title}</div>
                  <div className="meta" style={{ marginTop: 5, fontSize: 10.5 }}>
                    {picked.year} / {picked.director.toUpperCase()} / {picked.runtime}MIN / {picked.country.toUpperCase()}
                  </div>
                </div>
                <button type="button" className="btn-ghost" style={{ font: '400 12px var(--sans)', letterSpacing: '0.12em', color: 'var(--ink-5)' }} onClick={() => { setPicked(null); setQuery(''); }}>
                  CHANGE
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <div className="field">
                  <Icon name="search" size={17} colour="var(--ink-6)" />
                  {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                  <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title or director" />
                </div>
                {matches.length > 0 && (
                  <div className="list" style={{ marginTop: 8 }}>
                    {matches.map((f) => (
                      <button key={f.id} type="button" className="list-row" style={{ minHeight: 62 }} onClick={() => setPicked(f)}>
                        <Thumb film={f} w={32} h={46} />
                        <span style={{ flexGrow: 1, font: '500 15px var(--sans)', color: 'var(--ink)' }}>{f.title}</span>
                        <span className="meta" style={{ fontSize: 10 }}>{f.year} / {f.director.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                )}
                {query.trim() && matches.length === 0 && (
                  <div className="meta" style={{ marginTop: 12, color: 'var(--ink-6)' }}>
                    {busy
                      ? 'SEARCHING…'
                      : mode === 'tmdb'
                        ? 'NO MATCHES'
                        : 'NOT IN THE STARTER CATALOGUE — ADD A TMDB KEY IN TUNE MY TASTE TO SEARCH EVERYTHING'}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <div style={{ flexGrow: 1, minWidth: 260 }}>
              <div className="lbl">When</div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="chip" style={{ height: 44 }} aria-pressed={watchedOn === todayISO()} onClick={() => setWatchedOn(todayISO())}>TODAY</button>
                <button type="button" className="chip" style={{ height: 44 }} aria-pressed={watchedOn === shiftISO(-1)} onClick={() => setWatchedOn(shiftISO(-1))}>YESTERDAY</button>
                <label className="field" style={{ height: 44, cursor: 'pointer' }}>
                  <Icon name="calendar" size={15} width={1.6} colour="var(--ink-3)" />
                  <input type="date" value={watchedOn} max={todayISO()} onChange={(e) => setWatchedOn(e.target.value)} aria-label="Date watched" style={{ colorScheme: 'dark' }} />
                </label>
              </div>
            </div>

            <div style={{ width: 236 }}>
              <div className="lbl">Watch type</div>
              <div className="seg" style={{ marginTop: 10 }}>
                <button type="button" aria-pressed={!rewatch} onClick={() => setRewatch(false)}>FIRST</button>
                <button type="button" aria-pressed={rewatch} onClick={() => setRewatch(true)}>REWATCH</button>
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span className="lbl">Your score</span>
              <span style={{ font: '500 28px var(--sans)', lineHeight: 1, color: 'var(--cyan)' }}>
                {(score / 10).toFixed(1)}
              </span>
            </div>
            <input className="slider" type="range" min={0} max={100} value={score} aria-label="Your score" onChange={(e) => setScore(Number(e.target.value))} style={{ marginTop: 14 }} />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              {['0', '5', '10'].map((t) => (
                <span key={t} className="meta" style={{ fontSize: 10, color: 'var(--ink-8)' }}>{t}</span>
              ))}
            </div>
          </div>

          <div>
            <div className="lbl">Note <span style={{ color: 'var(--ink-8)' }}>— optional</span></div>
            <textarea className="note" style={{ marginTop: 10 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What stayed with you?" />
          </div>

          <div>
            <div className="lbl">Add to collections</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {state.collections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="chip"
                  aria-pressed={collections.includes(c.id)}
                  onClick={() =>
                    setCollections((prev) => (prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]))
                  }
                >
                  <span style={{ width: 5, height: 5, background: c.colour }} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <span
            className="meta foot-note"
            style={{ fontSize: 10, color: armed ? 'var(--magenta-hi)' : 'var(--ink-7)' }}
          >
            {armed
              ? 'THIS DELETES THE WATCH AND ITS SCORE — THERE IS NO UNDO'
              : !picked
                ? 'PICK A FILM TO CONTINUE'
                : editing
                  ? 'UPDATES YOUR SCORE AND YOUR PICKS'
                  : `THIS WILL BE FILM ${state.log.length + 1} AND UPDATES YOUR PICKS`}
          </span>
          {editing && (
            <button
              type="button"
              className={armed ? 'btn btn-danger is-armed' : 'btn btn-danger'}
              onClick={() => (armed ? remove() : setArmed(true))}
            >
              {armed ? 'TAP AGAIN' : 'REMOVE'}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>CANCEL</button>
          <button type="button" className="btn btn-primary" disabled={!picked} onClick={save}>
            <Icon name="check" size={15} width={2.2} colour="var(--void)" />
            {editing ? 'SAVE CHANGES' : 'SAVE TO LOG'}
          </button>
        </div>
      </div>
    </div>
  );
}
