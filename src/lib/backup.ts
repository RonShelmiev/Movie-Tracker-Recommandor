import type { AppState, Film } from './types';

/**
 * Export / import.
 *
 * Everything you log lives in one browser's localStorage, which makes a backup
 * the difference between "I cleared my cookies" and "I lost four years of film
 * history". The export is deliberately plain JSON so it stays readable and
 * re-importable without this app.
 */

export const BACKUP_VERSION = 1;

export interface Backup {
  app: 'flick';
  version: number;
  exportedAt: string;
  state: AppState;
  /** Cached remote film metadata, so an imported log still resolves offline. */
  films: Film[];
}

export function buildBackup(state: AppState, films: Film[]): Backup {
  return {
    app: 'flick',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state,
    films,
  };
}

export function backupFilename(state: AppState): string {
  const day = new Date().toISOString().slice(0, 10);
  return `flick-${day}-${state.log.length}-films.json`;
}

export function download(backup: Backup, filename: string): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface ParseResult {
  ok: boolean;
  message: string;
  backup?: Backup;
}

/** Validates enough to refuse someone else's JSON without pretending to be a schema validator. */
export function parseBackup(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: 'That file is not valid JSON.' };
  }

  if (typeof data !== 'object' || data === null) {
    return { ok: false, message: 'That file does not contain a Flick backup.' };
  }

  const b = data as Partial<Backup>;
  if (b.app !== 'flick') {
    return { ok: false, message: 'That is not a Flick backup — no "app": "flick" marker.' };
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    return {
      ok: false,
      message: `That backup is version ${String(b.version)}, newer than this build understands (${BACKUP_VERSION}).`,
    };
  }
  if (!b.state || !Array.isArray(b.state.log)) {
    return { ok: false, message: 'That backup has no log in it.' };
  }

  const films = Array.isArray(b.films) ? b.films : [];
  return {
    ok: true,
    message: `${b.state.log.length} logged, ${b.state.watchlist?.length ?? 0} on the list, ${films.length} cached films.`,
    backup: { ...(b as Backup), films },
  };
}

/** Union by film + date, so importing the same file twice does not double your history. */
export function mergeStates(current: AppState, incoming: AppState): AppState {
  const key = (filmId: string, watchedOn: string) => `${filmId}@${watchedOn}`;
  const seen = new Set(current.log.map((e) => key(e.filmId, e.watchedOn)));
  const log = [
    ...current.log,
    ...incoming.log.filter((e) => !seen.has(key(e.filmId, e.watchedOn))),
  ].sort((a, b) => b.watchedOn.localeCompare(a.watchedOn));

  const listed = new Set(current.watchlist.map((w) => w.filmId));
  const watchlist = [
    ...current.watchlist,
    ...incoming.watchlist.filter((w) => !listed.has(w.filmId)),
  ];

  const collections = [...current.collections];
  for (const inc of incoming.collections) {
    const existing = collections.find((c) => c.id === inc.id);
    if (existing) {
      existing.filmIds = [...new Set([...existing.filmIds, ...inc.filmIds])];
    } else {
      collections.push(inc);
    }
  }

  return {
    log,
    watchlist,
    collections,
    dismissed: [...new Set([...current.dismissed, ...incoming.dismissed])],
    // Settings are a preference, not data to merge — the importing device keeps its own.
    settings: current.settings,
    onboarded: true,
  };
}
