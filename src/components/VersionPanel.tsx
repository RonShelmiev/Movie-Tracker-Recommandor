import { useState } from 'react';
import { BUILD_ID, isDevBuild } from '../lib/updater';
import { updater } from './UpdateBanner';

/**
 * What build am I actually running? Worth being able to read off the screen:
 * "is this the new one?" used to be answerable only by deleting the app from
 * the home screen and adding it back.
 */
export function VersionPanel() {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    setNote(null);
    try {
      const u = updater();
      if (!u) {
        setNote('This browser cannot auto-update. Pull down to refresh instead.');
        return;
      }
      await u.check();
      // A newer build announces itself through the banner; silence means this
      // is already the current one.
      setNote('Checked. If a newer build exists, a bar appears at the top.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span className="h3">VERSION</span>
        <span className="meta" style={{ fontSize: 10, color: 'var(--ink-5)' }}>{isDevBuild() ? 'DEV' : BUILD_ID}</span>
      </div>

      <p className="cloud-copy">
        Flick updates itself — when a new version is out, opening the app picks it up. You should
        never need to remove it from your home screen and add it again.
      </p>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void check()}>
          {busy ? 'CHECKING…' : 'CHECK FOR UPDATE'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => void updater()?.reset()}
          title="Clears the offline copy and reloads from scratch. Your films are not touched."
        >
          FORCE REFRESH
        </button>
      </div>

      {note && <div className="cloud-note is-ok">{note}</div>}

      <div className="meta" style={{ marginTop: 14, fontSize: 9.5, lineHeight: 1.7, color: 'var(--ink-7)' }}>
        FORCE REFRESH THROWS AWAY THE OFFLINE COPY AND FETCHES THE APP AGAIN. IT DOES NOT TOUCH YOUR
        LOGGED FILMS, YOUR LIST OR YOUR KEYS.
      </div>
    </div>
  );
}
