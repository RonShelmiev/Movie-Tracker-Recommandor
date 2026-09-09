import { Link } from 'react-router-dom';
import type { Film } from '../lib/types';
import { StatusMark } from './ui';

export function posterClass(film: Film) {
  return `poster art-${film.art}`;
}

export function Poster({
  film,
  status,
  caption = true,
}: {
  film: Film;
  status?: 'seen' | 'listed' | null;
  caption?: boolean;
}) {
  return (
    <Link to={`/film/${film.id}`} className={posterClass(film)} aria-label={film.title}>
      <span className="fade" />
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
  return <span className={`thumb art-${film.art}`} style={{ width: w, height: h }} aria-hidden="true" />;
}
