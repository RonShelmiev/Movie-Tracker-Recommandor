import { Link } from 'react-router-dom';
import { posterUrl } from '../lib/tmdb';
import type { Film } from '../lib/types';
import { StatusMark } from './ui';

export function posterClass(film: Film) {
  return `poster art-${film.art}`;
}

export function Poster({
  film,
  status,
  caption = true,
  match = null,
}: {
  film: Film;
  status?: 'seen' | 'listed' | null;
  caption?: boolean;
  /** How well it fits the taste profile, 0-100. Null hides the badge. */
  match?: number | null;
}) {
  return (
    <Link
      to={`/film/${film.id}`}
      className={posterClass(film)}
      aria-label={match === null ? film.title : `${film.title} — ${match}% match`}
    >
      {film.posterPath && (
        <img className="art-img" src={posterUrl(film.posterPath, 'w342')} alt="" loading="lazy" />
      )}
      <span className="fade" />
      {match !== null && (
        <span className={match >= 70 ? 'match-pip is-strong' : 'match-pip'} aria-hidden="true">
          {match}
        </span>
      )}
      {status && <StatusMark kind={status} />}
      {caption && (
        <span className="cap">
          <b>{film.title}</b>
          <span>
            {film.year} / {Math.floor(film.runtime / 60)}H{String(film.runtime % 60).padStart(2, '0')}
          </span>
        </span>
      )}
    </Link>
  );
}

/** Same artwork, no link or caption — for list rows and modals. */
export function Thumb({ film, w, h }: { film: Film; w: number; h: number }) {
  return (
    <span className={`thumb art-${film.art}`} style={{ width: w, height: h }} aria-hidden="true">
      {film.posterPath && <img className="art-img" src={posterUrl(film.posterPath, 'w342')} alt="" loading="lazy" />}
    </span>
  );
}
