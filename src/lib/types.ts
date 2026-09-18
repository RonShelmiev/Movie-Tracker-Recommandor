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
  /** 0-7, picks one of the procedural poster treatments (the fallback when there is no artwork). */
  art: number;
  /** TMDB poster path, when the film came from TMDB. Absent for the bundled catalogue. */
  posterPath?: string;
  synopsis: string;
}

export interface LogEntry {
  /** Stable handle, so an entry can be edited without matching on film + date. */
  id: string;
  filmId: string;
  /** ISO date, day precision. */
  watchedOn: string;
  rewatch: boolean;
  /** 0-10, one decimal. */
  score: number;
  note?: string;
  /**
   * When this entry was last written, ISO with time. Sync needs it: with two
   * copies of the same entry and no timestamp, the merge can only prefer one
   * side by position, which silently drops whichever edit it did not pick.
   * Absent on entries written before sync existed — treated as oldest.
   */
  updatedAt?: string;
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
  /**
   * Ids of log entries that were deleted. A union merge cannot tell "removed
   * on the other device" from "not seen yet", so without these a film you
   * unlogged on your phone reappears the next time the laptop syncs.
   */
  deletedLogIds: string[];
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
  /**
   * Set when a "more like this" focus is what put this here. It reads the
   * same for every result in that list, so it belongs on a card once rather
   * than repeated down a column.
   */
  seedReason?: string;
}
