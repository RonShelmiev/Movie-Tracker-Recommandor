export type Genre =
  | 'Sci-fi' | 'Neo-noir' | 'Drama' | 'Thriller' | 'Crime' | 'Animation'
  | 'Horror' | 'Action' | 'Mystery' | 'Romance' | 'War' | 'Comedy';

/** Editorial style/mood tags. These are the axes the recommender actually reasons over. */
export type Tag =
  | 'cerebral' | 'slow' | 'bleak' | 'stylish' | 'rain' | 'long-take' | 'minimal-score'
  | 'twist' | 'one-location' | 'body-horror' | 'time-loop' | 'surveillance' | 'dystopia'
  | 'space' | 'ai' | 'memory' | 'grief' | 'procedural' | 'satire' | 'anime' | 'arthouse'
  | 'blockbuster' | 'noir-lighting' | 'desert' | 'city-at-night' | 'practical-fx' | 'ensemble';

export interface Film {
  id: string;
  title: string;
  year: number;
  /** Minutes. Theatrical cut where versions differ — see data/catalogue.ts. */
  runtime: number;
  director: string;
  country: string;
  genres: Genre[];
  tags: Tag[];
  /** Stand-in for a community score, 0-100. Replaced by real ratings when a catalogue source is wired up. */
  acclaim: number;
  /** Number of community ratings, in thousands. Drives the "surface the obscure" rule. */
  ratingsK: number;
  /** 0-7, picks one of the procedural poster treatments. */
  art: number;
  synopsis: string;
}

export interface LogEntry {
  filmId: string;
  /** ISO date, day precision. */
  watchedOn: string;
  rewatch: boolean;
  /** 0-10, one decimal. */
  score: number;
  note?: string;
}

export interface WatchlistEntry {
  filmId: string;
  addedOn: string;
  /** Why it is on the list — either "you added it" or the engine's reason. */
  source: string;
}

export interface Collection {
  id: string;
  name: string;
  colour: string;
  filmIds: string[];
}

export interface Settings {
  /** Each 0-100. */
  weights: {
    people: number;
    affinity: number;
    runtimeFit: number;
    era: number;
    community: number;
  };
  /** Minutes, or null for no ceiling. */
  runtimeCeiling: number | null;
  excludedGenres: Genre[];
  includeRewatches: boolean;
  surfaceObscure: boolean;
}

export interface AppState {
  log: LogEntry[];
  watchlist: WatchlistEntry[];
  /** Film ids the user said "not for me" to. Never recommended again. */
  dismissed: string[];
  collections: Collection[];
  settings: Settings;
  /** Set once the first-run flow is done, so an emptied library does not bounce back to onboarding. */
  onboarded: boolean;
}

export interface Recommendation {
  film: Film;
  /** 0-100. */
  match: number;
  reasons: string[];
}
