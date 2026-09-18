import type { AppState, Film, Genre, LogEntry } from './types';

export interface Stats {
  seen: number;
  distinct: number;
  toSee: number;
  hours: number;
  meanScore: number;
  seenLast30: number;
  addedLast30: number;
  queuedMinutes: number;
}

const dayjsAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export function computeStats(
  state: AppState,
  getFilm: (id: string) => Film | undefined,
): Stats {
  const rated = state.log.filter((e) => getFilm(e.filmId));
  const minutes = rated.reduce((s, e) => s + (getFilm(e.filmId)?.runtime ?? 0), 0);
  const cutoff = dayjsAgo(30);
  return {
    seen: rated.length,
    distinct: new Set(rated.map((e) => e.filmId)).size,
    toSee: state.watchlist.length,
    hours: Math.round(minutes / 60),
    meanScore: rated.length ? rated.reduce((s, e) => s + e.score, 0) / rated.length : 0,
    seenLast30: rated.filter((e) => e.watchedOn >= cutoff).length,
    addedLast30: state.watchlist.filter((w) => w.addedOn >= cutoff).length,
    queuedMinutes: state.watchlist.reduce((s, w) => s + (getFilm(w.filmId)?.runtime ?? 0), 0),
  };
}

export interface GenreCount {
  genre: Genre;
  count: number;
}

export function genreCounts(
  log: LogEntry[],
  getFilm: (id: string) => Film | undefined,
): GenreCount[] {
  const m = new Map<Genre, number>();
  for (const e of log) {
    const f = getFilm(e.filmId);
    if (!f) continue;
    for (const g of f.genres) m.set(g, (m.get(g) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

export interface MonthBucket {
  label: string;
  month: number;
  count: number;
}

/** Films per month for a given year, Jan up to December (or today, for the current year). */
export function perMonth(log: LogEntry[], year: number): MonthBucket[] {
  const now = new Date();
  const last = year === now.getFullYear() ? now.getMonth() : 11;
  const labels = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const buckets: MonthBucket[] = [];
  for (let m = 0; m <= last; m += 1) {
    buckets.push({ label: labels[m], month: m, count: 0 });
  }
  for (const e of log) {
    const d = new Date(e.watchedOn);
    if (d.getFullYear() !== year) continue;
    const b = buckets[d.getMonth()];
    if (b) b.count += 1;
  }
  return buckets;
}

export interface MonthGroup {
  key: string;
  label: string;
  entries: LogEntry[];
}

/** Log entries grouped by month, newest first. */
export function groupByMonth(log: LogEntry[]): MonthGroup[] {
  const fmt = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
  const groups = new Map<string, MonthGroup>();
  for (const e of log) {
    const key = e.watchedOn.slice(0, 7);
    const g = groups.get(key) ?? { key, label: fmt.format(new Date(e.watchedOn)).toUpperCase(), entries: [] };
    g.entries.push(e);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export function loggedYears(log: LogEntry[]): number[] {
  const years = new Set(log.map((e) => Number(e.watchedOn.slice(0, 4))));
  return [...years].sort((a, b) => b - a);
}
