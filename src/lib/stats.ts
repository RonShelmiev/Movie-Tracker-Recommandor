import { isRated } from './store';
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
  const scored = rated.filter(isRated);
  const minutes = rated.reduce((s, e) => s + (getFilm(e.filmId)?.runtime ?? 0), 0);
  const cutoff = dayjsAgo(30);
  return {
    seen: rated.length,
    distinct: new Set(rated.map((e) => e.filmId)).size,
    toSee: state.watchlist.length,
    hours: Math.round(minutes / 60),
    // Of the films you scored, not of the films you logged: a first-run
    // "seen" carries a placeholder, and averaging it in moves this number.
    meanScore: scored.length ? scored.reduce((s, e) => s + e.score, 0) / scored.length : 0,
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

/** How the Seen list is ordered and sectioned. */
export type SeenSort = 'watched' | 'score' | 'year' | 'genre';

export interface SeenGroup {
  key: string;
  label: string;
  entries: LogEntry[];
}

const byTitle = (getFilm: (id: string) => Film | undefined) => (a: LogEntry, b: LogEntry) =>
  (getFilm(a.filmId)?.title ?? '').localeCompare(getFilm(b.filmId)?.title ?? '');

/** Score bands, top down. A 10 gets its own band — it is a different statement from a 9.5. */
const BANDS: { min: number; label: string }[] = [
  { min: 10, label: '10 / MASTERPIECE' },
  { min: 9, label: '9 – 9.9' },
  { min: 8, label: '8 – 8.9' },
  { min: 7, label: '7 – 7.9' },
  { min: 6, label: '6 – 6.9' },
  { min: 5, label: '5 – 5.9' },
  { min: -Infinity, label: 'UNDER 5' },
];

/**
 * The Seen list, sectioned by whichever axis was picked. `desc` is the
 * natural reading for each: best first, newest first. Genre has no
 * direction of its own — sections run largest first and `desc` orders the
 * films inside them by score.
 *
 * A film carries several genres and appears under each. Filing it under
 * only the first would hide Blade Runner from Neo-noir because its row
 * happens to say Sci-fi first.
 */
export function groupSeen(
  log: LogEntry[],
  getFilm: (id: string) => Film | undefined,
  sort: SeenSort,
  desc: boolean,
): SeenGroup[] {
  const dir = desc ? -1 : 1;
  const known = log.filter((e) => getFilm(e.filmId));
  const title = byTitle(getFilm);

  if (sort === 'watched') {
    const groups = groupByMonth(known);
    for (const g of groups) g.entries.sort((a, b) => dir * a.watchedOn.localeCompare(b.watchedOn));
    return desc ? groups : groups.reverse();
  }

  if (sort === 'score') {
    const ordered = [...known].sort((a, b) => dir * (a.score - b.score) || title(a, b));
    const groups: SeenGroup[] = [];
    for (const e of ordered) {
      const band = BANDS.find((b) => e.score >= b.min)!;
      const last = groups[groups.length - 1];
      if (last && last.key === band.label) last.entries.push(e);
      else groups.push({ key: band.label, label: band.label, entries: [e] });
    }
    return groups;
  }

  if (sort === 'year') {
    const year = (e: LogEntry) => getFilm(e.filmId)!.year;
    const ordered = [...known].sort((a, b) => dir * (year(a) - year(b)) || b.score - a.score);
    const groups: SeenGroup[] = [];
    for (const e of ordered) {
      const dec = Math.floor(year(e) / 10) * 10;
      const key = `${dec}s`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.entries.push(e);
      else groups.push({ key, label: `${dec}S`, entries: [e] });
    }
    return groups;
  }

  const byGenre = new Map<string, LogEntry[]>();
  for (const e of known) {
    const genres = getFilm(e.filmId)!.genres;
    for (const g of genres.length ? genres : ['Other']) {
      const list = byGenre.get(g) ?? [];
      list.push(e);
      byGenre.set(g, list);
    }
  }
  return [...byGenre.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([g, entries]) => ({
      key: g,
      label: g.toUpperCase(),
      entries: entries.sort((a, b) => dir * (a.score - b.score) || title(a, b)),
    }));
}
