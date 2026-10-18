import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * The router swaps the page but never touches the scroll position, so
 * tapping a film halfway down Browse opened its page halfway down too — past
 * the poster, the title and the score, which read as the page not loading.
 *
 * A new page starts at the top. Going back returns to where you were, which
 * is the other half of the same complaint: losing your place in a long list.
 */
export function ScrollMemory() {
  const location = useLocation();
  const type = useNavigationType();
  const positions = useRef(new Map<string, number>());
  // The key alone is not enough: a hash typed or followed from outside the
  // app arrives as a POP with the shared key "default", which would have
  // handed one page another page's scroll position.
  const id = `${location.key}|${location.pathname}${location.search}`;
  const current = useRef(id);

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    // Recorded as you scroll rather than on the way out: by the time a route
    // change commits, the old page is gone and the browser has already
    // clamped scrollY to the new page's height.
    const onScroll = () => positions.current.set(current.current, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    current.current = id;
    const saved = type === 'POP' ? positions.current.get(id) : undefined;
    window.scrollTo(0, saved ?? 0);
  }, [id, type]);

  return null;
}
