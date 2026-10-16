import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function Meter({ pct, dim = false }: { pct: number; dim?: boolean }) {
  return (
    <div className={dim ? 'meter meter-dim' : 'meter'}>
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Chip({
  label,
  on = false,
  danger = false,
  onClick,
  children,
}: {
  label?: string;
  on?: boolean;
  danger?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={danger ? 'chip chip-danger' : 'chip'}
      aria-pressed={on}
      onClick={onClick}
    >
      {children ?? label}
    </button>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      className="toggle"
      aria-pressed={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    >
      <i />
    </button>
  );
}

export function Slider({
  label,
  note,
  value,
  onChange,
}: {
  label: string;
  note: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ font: '400 14.5px var(--sans)', letterSpacing: '0.03em', color: 'var(--ink)' }}>
          {label}
        </span>
        <span className="meta" style={{ fontSize: 10.5, color: 'var(--ink-5)' }}>{note}</span>
      </div>
      <input
        className="slider"
        type="range"
        min={0}
        max={100}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ marginTop: 10 }}
      />
    </div>
  );
}

export function ToggleRow({
  label,
  sub,
  on,
  onChange,
}: {
  label: string;
  sub: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, minHeight: 62, borderBottom: '1px solid rgba(126,214,232,0.07)' }}>
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div style={{ font: '400 14.5px var(--sans)', letterSpacing: '0.03em', color: 'var(--ink)' }}>{label}</div>
        <div className="meta" style={{ marginTop: 4, fontSize: 10, color: 'var(--ink-6)' }}>{sub}</div>
      </div>
      <Toggle on={on} onChange={onChange} label={label} />
    </div>
  );
}

export function SectionHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="section-head">
      <span className="h3">{title}</span>
      <span className="rule" />
      {right}
    </div>
  );
}

export function StatusMark({ kind }: { kind: 'seen' | 'listed' }) {
  return (
    <div className={`mark ${kind}`}>
      {kind === 'seen' ? (
        <Icon name="check" size={12} width={2.4} colour="var(--cyan)" />
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--magenta)" aria-hidden="true">
          <path d="M6.5 3.5h11v17l-5.5-4.6-5.5 4.6z" />
        </svg>
      )}
    </div>
  );
}

export function Stat({ label, value, note, accent = false }: { label: string; value: string; note?: string; accent?: boolean }) {
  return (
    <div className="stat">
      <div className="lbl">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <b className={accent ? 'accent' : undefined}>{value}</b>
        {note && <span className="meta" style={{ color: 'var(--ink-7)' }}>{note}</span>}
      </div>
    </div>
  );
}

/**
 * A 10-point score drawn the Letterboxd way: five stars, halves allowed.
 * 9.4 is four and a half; 10 is five. The number stays the real score —
 * the stars are a reading aid.
 */
export function Stars({ score, size = 14 }: { score: number; size?: number }) {
  const halves = Math.round(Math.max(0, Math.min(10, score)));
  return (
    <span className="stars" role="img" aria-label={`${(halves / 2).toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = halves >= (i + 1) * 2 ? 'full' : halves === i * 2 + 1 ? 'half' : 'empty';
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={`star star-${fill}`}>
            <defs>
              <clipPath id={`half-${i}`}>
                <rect x="0" y="0" width="12" height="24" />
              </clipPath>
            </defs>
            <path className="star-bg" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z" />
            {fill !== 'empty' && (
              <path
                className="star-fg"
                d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z"
                clipPath={fill === 'half' ? `url(#half-${i})` : undefined}
              />
            )}
          </svg>
        );
      })}
    </span>
  );
}
