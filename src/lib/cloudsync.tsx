import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as cloud from './cloud';
import type { CloudConfig, Session } from './cloud';
import { mergeForSync } from './backup';
import { useCatalogue } from './catalogue';
import { useStore } from './store';
import type { AppState } from './types';

const CFG_KEY = 'flick.cloud.v1';
const SESSION_KEY = 'flick.session.v1';
/** Long enough that a burst of edits is one write, short enough to feel live. */
const PUSH_DELAY = 2500;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or over quota — this session still works */
  }
}

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'error';

export interface CloudApi {
  config: CloudConfig | null;
  setConfig: (c: CloudConfig | null) => void;
  session: Session | null;
  status: SyncStatus;
  /** Last thing that went wrong, for the Settings screen to show. */
  error: string | null;
  /** Set after a sign-up that needs the emailed confirmation link. */
  pendingConfirmation: string | null;
  lastSyncedAt: number | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  probe: (c: CloudConfig) => Promise<cloud.Probe>;
}

const Ctx = createContext<CloudApi | null>(null);

export function CloudProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useStore();
  const { candidates, remember } = useCatalogue();

  const [config, setConfigState] = useState<CloudConfig | null>(() => read<CloudConfig>(CFG_KEY));
  const [session, setSessionState] = useState<Session | null>(() => read<Session>(SESSION_KEY));
  const [status, setStatus] = useState<SyncStatus>('off');
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPending] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  /* The state as it is right now, for the debounced push to read without
     re-arming its timer on every keystroke. */
  const stateRef = useRef(state);
  stateRef.current = state;
  const filmsRef = useRef(candidates);
  filmsRef.current = candidates;
  /* Nothing is pushed until this device has first pulled and merged — or the
     first write would overwrite the server with a half-empty library. */
  const readyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const setConfig = useCallback((c: CloudConfig | null) => {
    write(CFG_KEY, c);
    setConfigState(c);
    if (!c) {
      write(SESSION_KEY, null);
      setSessionState(null);
      readyRef.current = false;
      setStatus('off');
    }
  }, []);

  const setSession = useCallback((s: Session | null) => {
    write(SESSION_KEY, s);
    setSessionState(s);
  }, []);

  /** Returns a session with a live token, refreshing it if it has expired. */
  const liveSession = useCallback(async (): Promise<Session | null> => {
    if (!config || !session) return null;
    if (session.expiresAt > Date.now()) return session;
    const fresh = await cloud.refreshSession(config, session.refreshToken);
    setSession(fresh);
    return fresh;
  }, [config, session, setSession]);

  /**
   * Runs a call with a live token, and if the server rejects it anyway,
   * refreshes once and tries again. A token can stop working before the
   * expiry we were told about — revoked server side, or the device clock is
   * off — and treating that first 401 as "your sign-in is over" logged people
   * out of a perfectly good session.
   */
  const withAuth = useCallback(
    async <T,>(fn: (s: Session) => Promise<T>): Promise<T | null> => {
      if (!config) return null;
      const s = await liveSession();
      if (!s) return null;
      try {
        return await fn(s);
      } catch (e) {
        if (!(e instanceof cloud.CloudError) || e.status !== 401) throw e;
        const fresh = await cloud.refreshSession(config, s.refreshToken);
        setSession(fresh);
        return await fn(fresh);
      }
    },
    [config, liveSession, setSession],
  );

  /** Pull, merge, adopt, push back. Safe to call at any point. */
  const syncNow = useCallback(async () => {
    if (!config || !session) return;
    setStatus('syncing');
    setError(null);
    try {
      const row = await withAuth((s) => cloud.pull(config, s));

      let next: AppState = stateRef.current;
      if (row) {
        next = mergeForSync(stateRef.current, row.state);
        // Remote films first so anything logged elsewhere resolves offline here.
        if (row.films?.length) remember(row.films);
        dispatch({ type: 'replace', state: next });
      }

      await withAuth((s) => cloud.push(config, s, next, filmsRef.current));
      readyRef.current = true;
      setLastSyncedAt(Date.now());
      setStatus('synced');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync failed';
      setError(msg);
      setStatus('error');
      // A refresh token that no longer works means the sign-in is over.
      if (e instanceof cloud.CloudError && e.status === 401) {
        setSession(null);
        readyRef.current = false;
      }
    }
  }, [config, session, withAuth, dispatch, remember, setSession]);

  // First sync once a configured, signed-in device loads.
  const bootedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!config || !session) {
      setStatus(config ? 'signed-out' : 'off');
      readyRef.current = false;
      return;
    }
    const key = `${config.url}|${session.userId}`;
    if (bootedFor.current === key) return;
    bootedFor.current = key;
    void syncNow();
  }, [config, session, syncNow]);

  // Push local changes, coalesced.
  useEffect(() => {
    if (!config || !session || !readyRef.current) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          setStatus('syncing');
          await withAuth((s) => cloud.push(config, s, stateRef.current, filmsRef.current));
          setLastSyncedAt(Date.now());
          setStatus('synced');
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not save to the cloud');
          setStatus('error');
        }
      })();
    }, PUSH_DELAY);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [state, candidates, config, session, withAuth]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!config) throw new Error('Add the project URL and key first.');
      setError(null);
      setPending(null);
      setStatus('syncing');
      try {
        setSession(await cloud.signIn(config, email.trim(), password));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not sign in');
        setStatus('error');
        throw e;
      }
    },
    [config, setSession],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!config) throw new Error('Add the project URL and key first.');
      setError(null);
      setPending(null);
      setStatus('syncing');
      try {
        const { session: s } = await cloud.signUp(config, email.trim(), password);
        if (s) setSession(s);
        // No session means the project wants the emailed link clicked first.
        else {
          setPending(email.trim());
          setStatus('signed-out');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create the account');
        setStatus('error');
        throw e;
      }
    },
    [config, setSession],
  );

  const doSignOut = useCallback(async () => {
    if (config && session) await cloud.signOut(config, session);
    setSession(null);
    readyRef.current = false;
    bootedFor.current = null;
    setStatus('signed-out');
    setError(null);
  }, [config, session, setSession]);

  const value = useMemo<CloudApi>(
    () => ({
      config,
      setConfig,
      session,
      status,
      error,
      pendingConfirmation,
      lastSyncedAt,
      signUp,
      signIn,
      signOut: doSignOut,
      syncNow,
      probe: cloud.probeCloud,
    }),
    [config, setConfig, session, status, error, pendingConfirmation, lastSyncedAt, signUp, signIn, doSignOut, syncNow],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCloud(): CloudApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCloud must be used inside CloudProvider');
  return ctx;
}
