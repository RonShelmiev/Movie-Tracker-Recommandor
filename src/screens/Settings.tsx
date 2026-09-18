import { useRef, useState } from 'react';
import { useCatalogue } from '../lib/catalogue';
import { Thumb } from '../components/Poster';
import { Chip, Slider, ToggleRow } from '../components/ui';
import { Icon } from '../components/Icon';
import { backupFilename, buildBackup, download, mergeStates, parseBackup } from '../lib/backup';
import { recommend } from '../lib/recommend';
import { DEFAULT_SETTINGS, useStore } from '../lib/store';
import type { Genre } from '../lib/types';

const CEILINGS: { label: string; value: number | null }[] = [
  { label: 'No limit', value: null },
  { label: 'Under 3h', value: 180 },
  { label: 'Under 2h', value: 120 },
  { label: 'Under 90m', value: 90 },
];

const EXCLUDABLE: Genre[] = ['Horror', 'Action', 'Romance', 'Comedy', 'War', 'Animation'];

export function Settings() {
  const { candidates, getFilm, mode, tmdbKey, setTmdbKey, probe, busy, remember, hydrating, hydratePosters } = useCatalogue();
  const { state, dispatch } = useStore();
  const [keyDraft, setKeyDraft] = useState(tmdbKey);
  const [probeResult, setProbeResult] = useState<{ ok: boolean; message: string; sample?: string } | null>(null);
  const [importNote, setImportNote] = useState<{ ok: boolean; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onImportFile(file: File) {
    const result = parseBackup(await file.text());
    if (!result.ok || !result.backup) {
      setImportNote({ ok: false, message: result.message });
      return;
    }
    const { backup } = result;
    remember(backup.films);
    dispatch({ type: 'replace', state: mergeStates(state, backup.state) });
    setImportNote({ ok: true, message: `Merged in ${result.message}` });
  }
  const { settings } = state;
  const preview = recommend(state, candidates, getFilm, 5);

  const set = (key: keyof typeof settings.weights) => (value: number) =>
    dispatch({ type: 'settings/weight', key, value });

  return (
    <div className="screen" style={{ gap: 30 }}>
      <div className="screen-head">
        <div>
          <h1 className="h1">TUNE MY TASTE</h1>
          <div className="meta">
            HOW THE ENGINE WEIGHS YOUR {state.log.length} LOGGED {state.log.length === 1 ? 'FILM' : 'FILMS'}
          </div>
        </div>
        <button
          type="button"
          className="btn"
          style={{ height: 40 }}
          onClick={() => dispatch({ type: 'settings/patch', patch: DEFAULT_SETTINGS })}
        >
          RESET TO DEFAULT
        </button>
      </div>

      <div className="split">
        <div>
          <div className="lbl">Signal weights</div>
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <Slider label="People you rate highly" note="DIRECTORS YOU KEEP COMING BACK TO" value={settings.weights.people} onChange={set('people')} />
            <Slider label="Genre and mood affinity" note="FROM YOUR SCORES, NOT YOUR TAGS" value={settings.weights.affinity} onChange={set('affinity')} />
            <Slider label="Runtime that fits your habits" note="LENGTHS YOU ACTUALLY FINISH" value={settings.weights.runtimeFit} onChange={set('runtimeFit')} />
            <Slider label="Era and period" note="THE DECADES YOU SKEW TOWARD" value={settings.weights.era} onChange={set('era')} />
            <Slider label="What everyone else scores" note="KEEP LOW TO STAY OFF THE BEATEN PATH" value={settings.weights.community} onChange={set('community')} />
          </div>

          <div className="lbl" style={{ display: 'block', marginTop: 34 }}>Hard rules</div>

          <div className="setting-row" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ width: 150, flexShrink: 0, font: '400 14px var(--sans)', color: 'var(--ink-3)' }}>Runtime ceiling</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CEILINGS.map((c) => (
                <Chip
                  key={c.label}
                  label={c.label}
                  on={settings.runtimeCeiling === c.value}
                  onClick={() => dispatch({ type: 'settings/patch', patch: { runtimeCeiling: c.value } })}
                />
              ))}
            </div>
          </div>

          <div className="setting-row" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ width: 150, flexShrink: 0, font: '400 14px var(--sans)', color: 'var(--ink-3)' }}>Never recommend</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EXCLUDABLE.map((g) => {
                const on = settings.excludedGenres.includes(g);
                return (
                  <Chip key={g} on={on} danger onClick={() => dispatch({ type: 'settings/toggleGenre', genre: g })}>
                    {g}
                    {on && <Icon name="close" size={11} width={2.2} colour="var(--magenta-hi)" />}
                  </Chip>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <ToggleRow
              label="Include rewatches in picks"
              sub="SUGGEST FILMS YOU HAVE ALREADY LOGGED"
              on={settings.includeRewatches}
              onChange={(v) => dispatch({ type: 'settings/patch', patch: { includeRewatches: v } })}
            />
            <ToggleRow
              label="Surface the obscure"
              sub="ALLOW FILMS WITH UNDER 200K RATINGS"
              on={settings.surfaceObscure}
              onChange={(v) => dispatch({ type: 'settings/patch', patch: { surfaceObscure: v } })}
            />
          </div>

          <div style={{ marginTop: 30, paddingTop: 22, borderTop: '1px solid var(--hairline)' }}>
            <div className="lbl">Your data</div>
            <p style={{ margin: '12px 0 0', maxWidth: 540, font: '300 13px var(--sans)', lineHeight: 1.6, color: 'var(--ink-4)' }}>
              Everything lives in this browser and nowhere else. Export regularly — clearing site data or switching
              device loses the lot otherwise.
            </p>

            <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm"
                disabled={state.log.length === 0 && state.watchlist.length === 0}
                onClick={() => {
                  const remote = candidates.filter((f) => f.id.startsWith('tmdb:'));
                  download(buildBackup(state, remote), backupFilename(state));
                }}
              >
                EXPORT BACKUP
              </button>

              <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
                IMPORT BACKUP
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onImportFile(file);
                  e.target.value = '';
                }}
              />
            </div>

            {importNote && (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  maxWidth: 540,
                  border: `1px solid ${importNote.ok ? 'rgba(78,226,242,0.3)' : 'rgba(255,77,158,0.3)'}`,
                  background: importNote.ok ? 'rgba(78,226,242,0.06)' : 'rgba(255,77,158,0.06)',
                  font: '300 12.5px var(--sans)',
                  lineHeight: 1.6,
                  color: importNote.ok ? 'var(--ink-2)' : 'var(--magenta-hi)',
                }}
              >
                {importNote.message}
              </div>
            )}

            <div className="meta" style={{ marginTop: 14, fontSize: 9.5, lineHeight: 1.7, color: 'var(--ink-7)' }}>
              IMPORTS MERGE RATHER THAN OVERWRITE — THE SAME FILM ON THE SAME DATE IS NOT DOUBLED, SO RE-IMPORTING IS
              SAFE.
            </div>

            <div style={{ marginTop: 26, paddingTop: 22, borderTop: '1px solid var(--hairline)' }}>
              <div className="lbl">Danger zone</div>
              <button
                type="button"
                className="btn"
                style={{ marginTop: 14, borderColor: 'rgba(255,77,158,0.35)', color: 'var(--magenta-hi)' }}
                onClick={() => {
                  if (confirm('Erase your entire log, list and settings? Export first — this cannot be undone.')) {
                    dispatch({ type: 'reset' });
                  }
                }}
              >
                ERASE EVERYTHING
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span className="h3">CATALOGUE</span>
              <span
                className="meta"
                style={{ fontSize: 10, color: mode === 'tmdb' ? 'var(--cyan)' : 'var(--ink-6)' }}
              >
                {mode === 'tmdb' ? 'TMDB CONNECTED' : `STARTER · ${candidates.length} FILMS`}
              </span>
            </div>

            <p style={{ margin: '14px 0 0', font: '300 13px var(--sans)', lineHeight: 1.6, color: 'var(--ink-4)' }}>
              Without a key you get the {candidates.length}-film starter set. A free{' '}
              <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer noopener">
                TMDB key
              </a>{' '}
              opens the full index, with real posters.
            </p>

            <div className="field" style={{ marginTop: 14 }}>
              <input
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="Paste a TMDB API key or v4 read token"
                aria-label="TMDB API key"
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setTmdbKey(keyDraft);
                  setProbeResult(null);
                }}
              >
                SAVE KEY
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy || !keyDraft.trim()}
                onClick={async () => {
                  setTmdbKey(keyDraft);
                  setProbeResult(await probe());
                }}
              >
                {busy ? 'TESTING…' : 'TEST CONNECTION'}
              </button>
              {tmdbKey && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setTmdbKey('');
                    setKeyDraft('');
                    setProbeResult(null);
                  }}
                >
                  REMOVE
                </button>
              )}
            </div>

            {probeResult && (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  border: `1px solid ${probeResult.ok ? 'rgba(78,226,242,0.3)' : 'rgba(255,77,158,0.3)'}`,
                  background: probeResult.ok ? 'rgba(78,226,242,0.06)' : 'rgba(255,77,158,0.06)',
                  font: '300 12.5px var(--sans)',
                  lineHeight: 1.6,
                  color: probeResult.ok ? 'var(--ink-2)' : 'var(--magenta-hi)',
                }}
              >
                {probeResult.message}
                {probeResult.sample && (
                  <div className="meta" style={{ marginTop: 8, fontSize: 10, color: 'var(--ink-6)' }}>
                    {probeResult.sample.toUpperCase()}
                  </div>
                )}
              </div>
            )}

            {mode === 'tmdb' && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
                {hydrating ? (
                  <>
                    <div className="meta" style={{ fontSize: 10, color: 'var(--cyan)' }}>
                      FETCHING POSTERS — {hydrating.done} / {hydrating.total}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div className="meter">
                        <i style={{ width: `${(hydrating.done / hydrating.total) * 100}%` }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span className="meta" style={{ fontSize: 10, color: 'var(--ink-6)' }}>
                      ARTWORK FOR THE STARTER CATALOGUE
                    </span>
                    <button type="button" className="btn btn-sm" onClick={() => void hydratePosters()}>
                      FETCH POSTERS
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="meta" style={{ marginTop: 14, fontSize: 9.5, lineHeight: 1.7, color: 'var(--ink-7)' }}>
              THE KEY IS KEPT IN THIS BROWSER ONLY. IT IS READ-ONLY, BUT ANY KEY IN A PAGE LIKE THIS IS VISIBLE TO
              WHOEVER OPENS IT — USE ONE YOU DO NOT MIND EXPOSING.
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="h3">WITH THESE SETTINGS</span>
              <span style={{ width: 6, height: 6, background: 'var(--cyan)', boxShadow: '0 0 8px rgba(78,226,242,0.9)' }} />
            </div>
            <div style={{ padding: '6px 20px 14px' }}>
              {preview.length === 0 && (
                <div style={{ padding: '18px 0', font: '300 13.5px var(--sans)', color: 'var(--ink-5)' }}>
                  Your rules have filtered everything out.
                </div>
              )}
              {preview.map((r) => (
                <div key={r.film.id} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 56, borderBottom: '1px solid rgba(126,214,232,0.07)' }}>
                  <Thumb film={r.film} w={30} h={42} />
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ font: '400 14px var(--sans)', letterSpacing: '0.03em', color: 'var(--ink-2)' }}>{r.film.title}</div>
                    <div className="meta" style={{ marginTop: 3, fontSize: 9.5, color: 'var(--ink-7)' }}>{r.film.year}</div>
                  </div>
                  <span style={{ font: '500 13px var(--mono)', color: 'var(--cyan)' }}>{r.match}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 20px 18px' }}>
              <div className="meta" style={{ fontSize: 10, color: 'var(--ink-7)' }}>
                RECOMPUTED LIVE / {state.log.length} FILMS / {candidates.length} CANDIDATES
              </div>
            </div>
          </div>

          {settings.weights.community > 60 && (
            <div style={{ padding: 20, border: '1px solid rgba(255,180,84,0.22)', background: 'rgba(255,180,84,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ marginTop: 5, width: 5, height: 5, flexShrink: 0, background: 'var(--amber)' }} />
                <div style={{ font: '300 13px var(--sans)', lineHeight: 1.6, color: '#C0A882' }}>
                  Community score is at {settings.weights.community}. Much above 60 and your picks start looking like a
                  streaming front page rather than yours.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
