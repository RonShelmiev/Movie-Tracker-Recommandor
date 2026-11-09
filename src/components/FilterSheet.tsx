import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export interface FilterGroup {
  label: string;
  /** The chips. They wrap — nothing in a group scrolls sideways. */
  content: ReactNode;
  /** What is chosen in this group, each removable from the summary line. */
  chosen?: { label: string; clear: () => void }[];
}

const PHONE = '(max-width: 860px)';

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => {
    try {
      return window.matchMedia(PHONE).matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

/**
 * Filters that never scroll sideways. On a desktop the groups sit inline and
 * wrap. On a phone they used to be single rows that scrolled sideways — 21
 * chips wrapped took 310px before the first film, so each row was made a
 * scroller instead, and half of every row was then out of sight and out of
 * mind. Now a phone gets one button and a sheet from the bottom that shows
 * every option at once, with whatever is chosen listed under the button so
 * it can be undone without opening anything.
 */
export function FilterSheet({
  groups,
  title = 'FILTERS',
  onClear,
  footer,
}: {
  groups: FilterGroup[];
  title?: string;
  onClear?: () => void;
  /** The sheet's main button, e.g. "SHOW 42 FILMS". Defaults to DONE. */
  footer?: string;
}) {
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const chosen = groups.flatMap((g) => g.chosen ?? []);

  // The page behind should not scroll while the sheet is up.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!phone) {
    return (
      <div className="filter-rows">
        {groups.map((g) => (
          <div key={g.label} className="filter-group">
            <span className="lbl filter-group-lbl">{g.label}</span>
            <div className="filter-row">{g.content}</div>
          </div>
        ))}
        {onClear && chosen.length > 0 && (
          <button type="button" className="btn btn-sm btn-ghost filter-clear" onClick={onClear}>
            CLEAR ALL
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="filter-summary">
        <button type="button" className="chip filter-open" aria-pressed={chosen.length > 0} onClick={() => setOpen(true)}>
          <Icon name="filters" size={14} width={1.8} />
          {title}
          {chosen.length > 0 && <span className="filter-count">{chosen.length}</span>}
        </button>
        {chosen.map((c) => (
          <button key={c.label} type="button" className="chip filter-chosen" aria-pressed="true" onClick={c.clear} aria-label={`Remove ${c.label}`}>
            {c.label}
            <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>

      {open && (
        <div className="sheet-scrim" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="sheet">
            <div className="sheet-head">
              <span className="h3">{title}</span>
              {onClear && chosen.length > 0 ? (
                <button type="button" className="link-btn" onClick={onClear}>Clear all</button>
              ) : (
                <span />
              )}
            </div>
            <div className="sheet-body">
              {groups.map((g) => (
                <div key={g.label} className="sheet-group">
                  <div className="lbl">{g.label}</div>
                  <div className="filter-row">{g.content}</div>
                </div>
              ))}
            </div>
            <div className="sheet-foot">
              <button type="button" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setOpen(false)}>
                {footer ?? 'DONE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
