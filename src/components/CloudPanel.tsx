import { useState } from 'react';
import { useCloud } from '../lib/cloudsync';
import { TABLE } from '../lib/cloud';
import { Icon } from './Icon';

/** The one-off SQL that creates the row and locks it to its owner. */
const SETUP_SQL = `create table if not exists ${TABLE} (
  user_id uuid primary key references auth.users on delete cascade,
  state jsonb not null,
  films jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table ${TABLE} enable row level security;

create policy "own row" on ${TABLE}
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);`;

const STATUS: Record<string, { text: string; colour: string }> = {
  off: { text: 'NOT SET UP', colour: 'var(--ink-6)' },
  'signed-out': { text: 'SIGNED OUT', colour: 'var(--ink-6)' },
  syncing: { text: 'SYNCING…', colour: 'var(--amber)' },
  synced: { text: 'SYNCED', colour: 'var(--cyan)' },
  error: { text: 'SYNC PROBLEM', colour: 'var(--magenta-hi)' },
};

export function CloudPanel() {
  const cloud = useCloud();
  const [url, setUrl] = useState(cloud.config?.url ?? '');
  const [key, setKey] = useState(cloud.config?.anonKey ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [probe, setProbe] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);

  const s = STATUS[cloud.status] ?? STATUS.off;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      /* the provider records the message */
    } finally {
      setBusy(false);
    }
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setShowSql(true);
    }
  };

  return (
    <div className="panel" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span className="h3">YOUR ACCOUNT</span>
        <span className="meta" style={{ fontSize: 10, color: s.colour }}>{s.text}</span>
      </div>

      {cloud.session ? (
        <>
          <p className="cloud-copy">
            Signed in as <b style={{ color: 'var(--ink-hi)' }}>{cloud.session.email}</b>. Your library
            syncs to your own Supabase project — open Flick anywhere, sign in, and it is all there.
          </p>
          {cloud.lastSyncedAt && (
            <div className="meta" style={{ marginTop: 10, fontSize: 10, color: 'var(--ink-7)' }}>
              LAST SYNCED {new Date(cloud.lastSyncedAt).toLocaleTimeString()}
            </div>
          )}
          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run(cloud.syncNow)}>
              SYNC NOW
            </button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void run(cloud.signOut)}>
              SIGN OUT
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="cloud-copy">
            Optional. Without it Flick keeps everything in this browser only — which is why an
            installed app starts empty. With it, your library follows you.
          </p>

          <ol className="cloud-steps">
            <li>
              Make a free project at{' '}
              <a href="https://supabase.com" target="_blank" rel="noreferrer noopener">supabase.com</a>.
            </li>
            <li>
              In its SQL editor, run{' '}
              <button type="button" className="link-btn" onClick={() => void copySql()}>
                {copied ? 'copied ✓' : 'this one-off setup'}
              </button>
              {' '}
              <button type="button" className="link-btn" onClick={() => setShowSql((v) => !v)}>
                ({showSql ? 'hide' : 'show'})
              </button>
            </li>
            <li>Paste its Project URL and anon public key below, then create your account.</li>
          </ol>

          {showSql && <pre className="cloud-sql">{SETUP_SQL}</pre>}

          <div className="field" style={{ marginTop: 14 }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourproject.supabase.co"
              aria-label="Supabase project URL"
              spellCheck={false}
              autoComplete="off"
              inputMode="url"
            />
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="anon public key"
              aria-label="Supabase anon key"
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!url.trim() || !key.trim()}
              onClick={() => cloud.setConfig({ url: url.trim(), anonKey: key.trim() })}
            >
              SAVE PROJECT
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy || !url.trim() || !key.trim()}
              onClick={() =>
                void run(async () => {
                  const cfg = { url: url.trim(), anonKey: key.trim() };
                  cloud.setConfig(cfg);
                  setProbe(await cloud.probe(cfg));
                })
              }
            >
              {busy ? 'CHECKING…' : 'TEST PROJECT'}
            </button>
            {cloud.config && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => { cloud.setConfig(null); setUrl(''); setKey(''); setProbe(null); }}
              >
                FORGET
              </button>
            )}
          </div>

          {probe && (
            <div className={probe.ok ? 'cloud-note is-ok' : 'cloud-note is-bad'}>{probe.message}</div>
          )}

          {cloud.config && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--hairline)' }}>
              <div className="lbl">Sign in</div>
              <div className="field" style={{ marginTop: 10 }}>
                <Icon name="search" size={16} colour="var(--ink-6)" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-label="Email"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password — at least 6 characters"
                  aria-label="Password"
                  autoComplete="current-password"
                />
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={busy || !email.trim() || password.length < 6}
                  onClick={() => void run(() => cloud.signIn(email, password))}
                >
                  SIGN IN
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busy || !email.trim() || password.length < 6}
                  onClick={() => void run(() => cloud.signUp(email, password))}
                >
                  CREATE ACCOUNT
                </button>
              </div>
            </div>
          )}

          {cloud.pendingConfirmation && (
            <div className="cloud-note is-ok">
              Check {cloud.pendingConfirmation} for a confirmation link, then sign in. (You can turn
              confirmation off in your project under Authentication → Providers → Email.)
            </div>
          )}
        </>
      )}

      {cloud.error && <div className="cloud-note is-bad">{cloud.error}</div>}

      <div className="meta" style={{ marginTop: 14, fontSize: 9.5, lineHeight: 1.7, color: 'var(--ink-7)' }}>
        THE PROJECT IS YOURS — NOBODY ELSE, INCLUDING WHOEVER BUILT THIS, CAN SEE WHAT IS IN IT. THE ANON
        KEY IS MEANT TO BE PUBLIC; WHAT KEEPS YOUR ROWS PRIVATE IS THE POLICY IN THE SETUP ABOVE.
      </div>
    </div>
  );
}
