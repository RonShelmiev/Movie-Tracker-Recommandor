import { Link } from 'react-router-dom';
import { useCatalogue } from '../lib/catalogue';

/**
 * Without a TMDB key the app quietly falls back to the bundled catalogue:
 * search only ever finds those films and every poster is a gradient. That
 * used to be invisible — the app looked broken rather than unconfigured —
 * so the state says so, on the screens where you would notice it.
 *
 * The key lives in this browser's storage, so clearing site data or moving
 * to another browser drops you back here. Hence the reminder rather than a
 * one-time nudge.
 */
export function StarterBanner() {
  const { mode, candidates } = useCatalogue();
  if (mode === 'tmdb') return null;

  return (
    <Link to="/settings" className="starter-note">
      <span className="starter-dot" aria-hidden="true" />
      <span>
        <b>STARTER CATALOGUE</b>
        <span>
          Searching {candidates.length} built-in films, with drawn artwork. Add a free TMDB key for the
          full index and real posters.
        </span>
      </span>
      <span className="starter-go" aria-hidden="true">
        SETTINGS
      </span>
    </Link>
  );
}
