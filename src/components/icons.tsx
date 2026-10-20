// Line-style icons extracted verbatim from the redesign prototype
// (design_handoff_onyx_app/Onyx Final Direction.dc.html) -- reused rather than redrawn.

interface IconProps {
  color?: string;
  size?: number;
}

export function TodayTabIcon({ color = '#ffffff', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke={color} strokeWidth={2} />
      <line x1="4" y1="9" x2="20" y2="9" stroke={color} strokeWidth={2} />
      <rect x="8" y="2.5" width="2" height="4" rx="1" fill={color} />
      <rect x="14" y="2.5" width="2" height="4" rx="1" fill={color} />
      <rect x="8" y="12" width="3" height="3" fill={color} />
    </svg>
  );
}

// Log/Settings keep their pre-redesign icons rather than the prototype's
// line-style set -- see redesign/integration polish pass.
export function LogTabIcon({ color = '#ffffff', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function HistoryTabIcon({ color = '#ffffff', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="none" stroke={color} strokeWidth={2} />
      <line x1="12" y1="12" x2="12" y2="7" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <line x1="12" y1="12" x2="15.5" y2="12" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

export function TrendsTabIcon({ color = '#ffffff', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="4" y="14" width="3.2" height="6" fill={color} />
      <rect x="10.4" y="9" width="3.2" height="11" fill={color} />
      <rect x="16.8" y="4" width="3.2" height="16" fill={color} />
    </svg>
  );
}

export function SettingsTabIcon({ color = '#ffffff', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// Progress-ring Onyx logo mark: circular track + partial arc + center dot.
// viewBox is fixed at its authored 34x34 coordinate space; width/height scale it.
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34">
      <circle cx="17" cy="17" r="13" fill="none" stroke="#27272a" strokeWidth={3} />
      <circle
        cx="17" cy="17" r="13" fill="none" stroke="#3b82f6" strokeWidth={3}
        strokeDasharray="62 100" strokeLinecap="round"
        transform="rotate(-90 17 17)"
      />
      <circle cx="17" cy="17" r="3.5" fill="#3b82f6" />
    </svg>
  );
}
