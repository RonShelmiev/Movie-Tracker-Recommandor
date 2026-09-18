import type { AppState, Film } from './types';

/**
 * Supabase adapter, spoken to over plain REST.
 *
 * ⚠️ NOT EXERCISED AGAINST A LIVE PROJECT. The sandbox this was written in
 * blocks egress to supabase.co, so the request shapes below come from
 * Supabase's documented GoTrue and PostgREST contracts rather than an observed
 * response. Everything here is tested against a mock; `probeCloud()` exists so
 * a real project can be checked from the Settings screen in one tap.
 *
 * No SDK: the surface needed is four auth calls and two table calls, and a
 * dependency would be one more thing between the person and their data in a
 * build that is deliberately a single file.
 *
 * The anon key is designed to be public — it is the key a browser ships with.
 * What protects the rows is row-level security, which the SQL in README.md
 * turns on: a signed-in user can read and write their own row and no other.
 */

export interface CloudConfig {
  /** https://<project>.supabase.co */
  url: string;
  anonKey: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
  email: string;
  userId: string;
}

export const TABLE = 'flick_state';

export class CloudError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'CloudError';
    this.status = status;
  }
}

function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Supabase reports failures under several different keys depending on the endpoint. */
function errorText(body: unknown, status: number): string {
  const b = (body ?? {}) as Record<string, unknown>;
  const pick = [b.error_description, b.msg, b.message, b.error, b.hint]
    .find((x) => typeof x === 'string' && x) as string | undefined;
  if (pick) return pick;
  if (status === 401) return 'Not authorised — check the key, or sign in again.';
  if (status === 404) return 'Not found — is the flick_state table created?';
  return `Request failed (${status}).`;
}

async function call<T>(
  cfg: CloudConfig,
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(cleanUrl(cfg.url) + path, {
      ...rest,
      headers: {
        apikey: cfg.anonKey.trim(),
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.headers ?? {}),
      },
    });
  } catch (e) {
    throw new CloudError(e instanceof Error ? e.message : 'Could not reach the server', 0);
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new CloudError(errorText(body, res.status), res.status);
  return body as T;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email: string };
  /** Present on a signup that still needs the emailed link. */
  id?: string;
  email?: string;
}

function toSession(r: TokenResponse): Session | null {
  if (!r.access_token || !r.refresh_token || !r.user) return null;
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    // A minute of slack so a request never goes out with a token about to die.
    expiresAt: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000,
    email: r.user.email,
    userId: r.user.id,
  };
}

export async function signUp(
  cfg: CloudConfig,
  email: string,
  password: string,
): Promise<{ session: Session | null }> {
  const r = await call<TokenResponse>(cfg, '/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  // No session back means the project has email confirmation switched on.
  return { session: toSession(r) };
}

export async function signIn(cfg: CloudConfig, email: string, password: string): Promise<Session> {
  const r = await call<TokenResponse>(cfg, '/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const s = toSession(r);
  if (!s) throw new CloudError('Signed in but no session came back.', 0);
  return s;
}

export async function refreshSession(cfg: CloudConfig, refreshToken: string): Promise<Session> {
  const r = await call<TokenResponse>(cfg, '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const s = toSession(r);
  if (!s) throw new CloudError('Could not refresh the session.', 401);
  return s;
}

export async function signOut(cfg: CloudConfig, session: Session): Promise<void> {
  // Best effort: the local session is dropped either way.
  try {
    await call(cfg, '/auth/v1/logout', { method: 'POST', token: session.accessToken });
  } catch {
    /* already expired or offline */
  }
}

export interface CloudRow {
  state: AppState;
  films: Film[];
  updatedAt: string;
}

export async function pull(cfg: CloudConfig, session: Session): Promise<CloudRow | null> {
  const rows = await call<{ state: AppState; films: Film[]; updated_at: string }[]>(
    cfg,
    `/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(session.userId)}&select=state,films,updated_at`,
    { method: 'GET', token: session.accessToken },
  );
  const row = rows?.[0];
  if (!row) return null;
  return { state: row.state, films: row.films ?? [], updatedAt: row.updated_at };
}

export async function push(
  cfg: CloudConfig,
  session: Session,
  state: AppState,
  films: Film[],
): Promise<void> {
  await call(cfg, `/rest/v1/${TABLE}`, {
    method: 'POST',
    token: session.accessToken,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([
      { user_id: session.userId, state, films, updated_at: new Date().toISOString() },
    ]),
  });
}

export interface Probe {
  ok: boolean;
  message: string;
}

/** Checks the URL and key before anyone types a password into them. */
export async function probeCloud(cfg: CloudConfig): Promise<Probe> {
  if (!cfg.url.trim() || !cfg.anonKey.trim()) return { ok: false, message: 'URL and key are both needed.' };
  if (!/^https:\/\/[^/]+/.test(cleanUrl(cfg.url))) {
    return { ok: false, message: 'The URL should look like https://yourproject.supabase.co' };
  }
  try {
    // Unauthenticated on purpose, so the URL, the key and the table are all
    // checked before anyone types a password. Row-level security answers an
    // anonymous read with an empty 200 rather than an error, so success here
    // is a 200 — a 401 means the key is wrong, and only that.
    await call(cfg, `/rest/v1/${TABLE}?select=user_id&limit=1`, { method: 'GET' });
    return { ok: true, message: 'Project, key and the flick_state table all check out.' };
  } catch (e) {
    if (e instanceof CloudError) {
      if (e.status === 401) return { ok: false, message: 'That key was rejected — check the anon public key.' };
      if (e.status === 404) {
        return { ok: false, message: 'No flick_state table yet — run the setup SQL in your project first.' };
      }
      if (e.status === 0) return { ok: false, message: `Could not reach the project: ${e.message}` };
    }
    return { ok: false, message: e instanceof Error ? e.message : 'Could not reach the project.' };
  }
}
