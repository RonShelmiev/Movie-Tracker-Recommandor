import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FIRST_RUN_PICKS } from '../data/catalogue';
import { useCatalogue } from '../lib/catalogue';
import { Icon } from '../components/Icon';
import { useStore } from '../lib/store';

const NEEDED = 5;

/**
 * iOS gives a home-screen web app a storage container of its own, separate
 * from Safari's. The library does not follow it across, which looks like the
 * app has lost everything rather than like a fresh install.
 */
function installedApp(): boolean {
  try {
    return (
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  } catch {
    return false;
  }
}

export function FirstRun() {
  const { getFilm } = useCatalogue();
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<string[]>([]);

  const films = FIRST_RUN_PICKS.map(getFilm).filter((f): f is NonNullable<typeof f> => Boolean(f));
  const remaining = Math.max(0, NEEDED - picked.length);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  return (
    <div className="firstrun">
      <div className="firstrun-inner">
        <div style={{ textAlign: 'center' }}>
          <div className="lbl" style={{ color: 'var(--cyan)' }}>First run</div>
          <h1 style={{ margin: '14px 0 0', font: '600 42px var(--sans)', letterSpacing: '0.04em', lineHeight: 1.06, color: 'var(--ink-hi)', textWrap: 'pretty' }}>
            NOTHING LOGGED YET
          </h1>
          <p style={{ margin: '16px auto 0', maxWidth: 540, font: '300 15px var(--sans)', lineHeight: 1.65, color: 'var(--ink-4)', textWrap: 'pretty' }}>
            The engine needs something to work from. Mark {NEEDED} films you have seen and it can make its first
            guess — the more you log, the sharper it gets.
          </p>
        </div>

        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <Link to="/settings" className="meta" style={{ fontSize: 10.5, color: 'var(--cyan)', letterSpacing: '0.12em' }}>
            ALREADY HAVE AN ACCOUNT? SIGN IN AND PULL YOUR LIBRARY →
          </Link>
        </div>

        {installedApp() && (
          <div className="starter-note" style={{ marginTop: 26 }}>
            <span className="starter-dot" aria-hidden="true" />
            <span>
              <b>ADDED TO YOUR HOME SCREEN</b>
              <span>
                An installed app gets its own storage, so anything you logged in the browser is not here.
                Export a backup from Settings in the browser, then <Link to="/settings">import it</Link> —
                your TMDB key needs entering again too.
              </span>
            </span>
          </div>
        )}

        <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <span className="h3">TAP THE ONES YOU HAVE SEEN</span>
          <span className="meta" style={{ color: picked.length >= NEEDED ? 'var(--cyan)' : 'var(--ink-4)' }}>
            {picked.length} OF {NEEDED} SELECTED
          </span>
        </div>

        <div className="seed-grid" style={{ marginTop: 16 }}>
          {films.map((f) => {
            const on = picked.includes(f.id);
            return (
              <button key={f.id} type="button" className="seed-tile" aria-pressed={on} onClick={() => toggle(f.id)}>
                <span className={`poster art-${f.art}`} style={{ display: 'block' }}>
                  <span className="fade" />
                </span>
                {on && (
                  <span className="tick">
                    <Icon name="check" size={11} width={3} colour="var(--void)" />
                  </span>
                )}
                <span className="name">{f.title}</span>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 34, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ height: 52, padding: '0 26px' }}
            disabled={picked.length < NEEDED}
            onClick={() => {
              dispatch({ type: 'onboard', filmIds: picked });
              navigate('/');
            }}
          >
            BUILD MY TASTE PROFILE
            <Icon name="arrow-right" size={15} width={1.9} colour="var(--void)" />
          </button>
          <span className="meta" style={{ fontSize: 10.5, color: 'var(--ink-7)' }}>
            {remaining > 0 ? `${remaining} MORE TO GO` : 'READY'}
          </span>
          <span style={{ flexGrow: 1 }} />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              dispatch({ type: 'onboard', filmIds: [] });
              navigate('/browse');
            }}
          >
            skip and browse instead
          </button>
        </div>

        <div style={{ marginTop: 34, paddingTop: 26, borderTop: '1px solid var(--hairline)' }}>
          <div className="meta" style={{ fontSize: 10, color: 'var(--ink-7)', lineHeight: 1.7 }}>
            SEEDED FILMS ARE LOGGED AT 7.5 — A NEUTRAL SCORE. RE-RATE THEM FROM THEIR OWN PAGES AND THE PICKS SHARPEN
            IMMEDIATELY.
          </div>
        </div>
      </div>
    </div>
  );
}
