export type IconName =
  | 'dashboard' | 'browse' | 'tosee' | 'seen' | 'foryou' | 'search' | 'filters'
  | 'plus' | 'close' | 'check' | 'chevron-down' | 'chevron-left' | 'arrow-right'
  | 'calendar' | 'upload' | 'pencil';

const PATHS: Record<IconName, JSX.Element> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" />
    </>
  ),
  browse: (
    <>
      <rect x="3" y="4.5" width="18" height="15" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" />
      <line x1="3" y1="14.5" x2="21" y2="14.5" />
      <line x1="8" y1="4.5" x2="8" y2="19.5" />
      <line x1="16" y1="4.5" x2="16" y2="19.5" />
    </>
  ),
  tosee: <path d="M6.5 3.5h11v17l-5.5-4.6-5.5 4.6z" />,
  seen: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.2 12.4l2.6 2.6 5-5.4" />
    </>
  ),
  foryou: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="1.6" x2="12" y2="4.2" />
      <line x1="12" y1="19.8" x2="12" y2="22.4" />
      <line x1="1.6" y1="12" x2="4.2" y2="12" />
      <line x1="19.8" y1="12" x2="22.4" y2="12" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.8" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" />
    </>
  ),
  filters: (
    <>
      <line x1="3.5" y1="8" x2="20.5" y2="8" />
      <circle cx="10" cy="8" r="2.6" />
      <line x1="3.5" y1="16" x2="20.5" y2="16" />
      <circle cx="15.5" cy="16" r="2.6" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  close: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'chevron-left': <path d="M14 6l-6 6 6 6" />,
  'arrow-right': (
    <>
      <path d="M5 12h13" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" />
      <line x1="3.5" y1="10" x2="20.5" y2="10" />
      <line x1="8" y1="2.5" x2="8" y2="6" />
      <line x1="16" y1="2.5" x2="16" y2="6" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 19h16" />
    </>
  ),
};

interface Props {
  name: IconName;
  size?: number;
  width?: number;
  colour?: string;
}

export function Icon({ name, size = 19, width = 1.5, colour = 'currentColor' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colour}
      strokeWidth={width}
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {PATHS[name]}
    </svg>
  );
}
