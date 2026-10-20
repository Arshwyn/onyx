import React from 'react';

interface ToggleSwitchProps {
  on: boolean;
  onClick: () => void;
  // Most callers (ToggleRow) wrap this in a <button> that already owns
  // focus/keyboard handling and toggles via the click bubbling up to it, so
  // the switch stays out of tab order and doesn't stop that bubble by
  // default. ToggleNavRow's switch sits inside a ribbon whose own click/Enter
  // target is a *different* action (opening a sheet) -- opting into this
  // makes the switch independently keyboard-operable and stops its own
  // click/Enter/Space from also triggering the ribbon's handler, instead of
  // losing Tab/Enter access to the toggle entirely.
  focusable?: boolean;
}

// iOS-style pill switch -- track 40x22, knob 18x18 sliding between left:2px/20px.
export default function ToggleSwitch({ on, onClick, focusable = false }: ToggleSwitchProps) {
  return (
    <div
      onClick={(e) => { if (focusable) e.stopPropagation(); onClick(); }}
      onKeyDown={focusable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClick(); }
      } : undefined}
      role="switch"
      aria-checked={on}
      tabIndex={focusable ? 0 : undefined}
      style={{ background: on ? '#3b82f6' : '#3f3f46' }}
      className="w-10 h-[22px] rounded-pill relative cursor-pointer shrink-0"
    >
      <div
        style={{ left: on ? '20px' : '2px' }}
        className="absolute top-0.5 w-[18px] h-[18px] rounded-pill bg-white transition-[left] duration-150"
      />
    </div>
  );
}
