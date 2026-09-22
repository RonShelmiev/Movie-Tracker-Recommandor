import { useEffect, useState } from 'react';
import { startUpdater } from '../lib/updater';
import type { Updater } from '../lib/updater';

let shared: Updater | null = null;

/** So Settings can drive the same registration this banner started. */
export function updater(): Updater | null {
  return shared;
}

/**
 * Sits above everything and stays invisible unless a new build arrived while
 * the app was already open. A launch updates itself without saying anything.
 */
export function UpdateBanner() {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!shared) shared = startUpdater(() => setWaiting(true));
  }, []);

  if (!waiting) return null;

  return (
    <div className="update-bar" role="status">
      <span className="update-dot" aria-hidden="true" />
      <span>A newer version of Flick is ready.</span>
      <button type="button" className="btn btn-sm btn-primary" onClick={() => window.location.reload()}>
        RELOAD
      </button>
      <button
        type="button"
        className="update-dismiss"
        aria-label="Not now"
        onClick={() => setWaiting(false)}
      >
        ✕
      </button>
    </div>
  );
}
