import { useEffect, useState } from 'react';
import { useCatalogue } from '../lib/catalogue';
import type { Film } from '../lib/types';

/**
 * The film's trailer, from the YouTube key TMDB lists for it. A still and a
 * play button until tapped: an embedded player on every film page would load
 * YouTube's half a megabyte of script whether or not anyone watches. The
 * no-cookie domain keeps YouTube from setting tracking cookies until play.
 *
 * Without an answer — no TMDB key on this device, TMDB lists nothing, or it
 * could not be reached — there is a YouTube search instead, which nearly
 * always finds it.
 */
export function Trailer({ film }: { film: Film }) {
  const { trailerFor } = useCatalogue();
  const [key, setKey] = useState<string | null | undefined>(undefined);
  const [asked, setAsked] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let live = true;
    setAsked(false);
    setPlaying(false);
    setKey(undefined);
    void trailerFor(film).then((k) => {
      if (!live) return;
      setKey(k);
      setAsked(true);
    });
    return () => {
      live = false;
    };
    // By id: the film object is rebuilt whenever the cache changes, and
    // re-asking each time made the player flicker back to its placeholder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [film.id, trailerFor]);

  const search = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${film.title} ${film.year} trailer`)}`;

  if (!asked) return <div className="trailer trailer-wait" aria-hidden="true" />;

  if (!key) {
    return (
      <a className="trailer-search" href={search} target="_blank" rel="noreferrer noopener">
        <span className="trailer-play-sm" aria-hidden="true" />
        FIND THE TRAILER ON YOUTUBE
      </a>
    );
  }

  return (
    <div className="trailer">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${key}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
          title={`${film.title} trailer`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button type="button" className="trailer-cover" onClick={() => setPlaying(true)} aria-label={`Play the ${film.title} trailer`}>
          <img src={`https://i.ytimg.com/vi/${key}/hqdefault.jpg`} alt="" loading="lazy" />
          <span className="trailer-play" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
