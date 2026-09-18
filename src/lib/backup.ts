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

  // Copied rather than edited in place: `current` is live React state, and
  // mutating a collection on it skips the re-render.
  const collections = current.collections.map((c) => ({ ...c, filmIds: [...c.filmIds] }));
  for (const inc of incoming.collections) {
    const existing = collections.find((c) => c.id === inc.id);
    if (existing) {
      existing.filmIds = [...new Set([...existing.filmIds, ...inc.filmIds])];
    } else {
      collections.push({ ...inc, filmIds: [...inc.filmIds] });
    }
  }

  return {
    log,
    watchlist,
    collections,
    dismissed: [...new Set([...current.dismissed, ...incoming.dismissed])],
    deletedLogIds: [...new Set([...current.deletedLogIds, ...(incoming.deletedLogIds ?? [])])].slice(0, 500),
    // Settings are a preference, not data to merge — the importing device keeps its own.
    settings: current.settings,
    onboarded: true,
  };
}

/**
 * Merge for cloud sync. Unlike an imported file, both sides here are the same
 * library at different moments, so entries are matched on their id and a
 * deletion recorded on either side wins over the copy the other still holds.
 * Without that, removing a film on one device and syncing on another simply
 * puts it back.
 */
export function mergeForSync(local: AppState, remote: AppState): AppState {
  const merged = mergeStates(local, remote);
  const tombstoned = new Set(merged.deletedLogIds);

  // Same entry on both sides: the one written later wins. Preferring a side
  // instead — local, say — silently drops whatever was edited on the other
  // device, which is the whole thing sync is for. Entries from before
  // timestamps existed count as oldest.
  const byId = new Map<string, (typeof merged.log)[number]>();
  for (const e of [...remote.log, ...local.log]) {
    if (tombstoned.has(e.id)) continue;
    const held = byId.get(e.id);
    if (!held || (e.updatedAt ?? '') >= (held.updatedAt ?? '')) byId.set(e.id, e);
  }

  return {
    ...merged,
    log: [...byId.values()].sort((a, b) => b.watchedOn.localeCompare(a.watchedOn)),
  };
}
