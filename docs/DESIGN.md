# Onyx design identity

This document records the look of Onyx as the code has it today. It describes; it does not prescribe changes. Tokens live in `tailwind.config.js`, shared primitives in `src/components/ui/`.

## Purpose and audience

Onyx is a self-hosted workout, cardio and body tracker (PWA manifest description: "Self-hosted workout, cardio, and body tracking"). It is used on a phone in a gym, often mid-set, and is installed as a standalone PWA (`display: standalone`). That shapes everything below:

- One-handed use: primary navigation is a fixed bottom bar, and the rest timer button floats at the right edge above it.
- Glanceable numbers: weights, reps, timers and targets are large, monospaced and high contrast on black.
- Safe areas: `viewport-fit=cover` is set in `index.html`, and `env(safe-area-inset-*)` padding is used on the bottom nav, the offline banner and toasts.

## Mood and direction

A dark, near-black, high-contrast interface with one accent colour (blue). Surfaces are barely lighter than the background and separated by 1px hairline borders rather than shadows. Headings are bold, italic and uppercase for a fast, athletic feel; data is monospaced. Colour carries meaning (blue = active/primary, green = done, yellow = personal record, orange = swapped/warning, red = skipped/danger) and is otherwise kept quiet.

## Palette roles

All tokens are defined in `tailwind.config.js` under `theme.extend.colors`.

| Token | Value | Role |
|---|---|---|
| `bg` | `#000000` | Page background (the app shell uses `bg-black`) |
| `surface` | `#111114` | Cards, bottom sheets, menus |
| `surface-alt` | `#0d0d0f` | Subtle card variant (rest state, add forms) |
| `border` (DEFAULT) | `#1f1f23` | Hairline borders on cards, nav, list dividers |
| `border-input` | `#232327` | Borders on inputs, chips, sheet top edge |
| `border-pill` | `#27272a` | Border of the rest timer button and some inputs |
| `border-subtle` | `#3f3f46` | Subtle emphasis; also the switch track when off and the multiply sign between set inputs |
| `text-primary` | `#ffffff` | Primary text |
| `text-secondary` | `#e4e4e7` | Secondary text, plate names |
| `text-tertiary` | `#a1a1aa` | Inactive chip text |
| `text-muted` | `#71717a` | Captions, micro-labels, close icons |
| `text-faint` | `#52525b` | Lowest emphasis: hints, empty states, timer labels |
| `accent` (DEFAULT) | `#3b82f6` | Primary actions, active chips, switch on, Today button, plate calculator target |
| `accent-light` | `#60a5fa` | Accent text and icons, timer label, chart line |
| `accent-lighter` | `#93c5fd` | Date pill text, avatar text |
| `success` (DEFAULT) | `#4ade80` | Logged/done state text and icons |
| `success-bg` | `#0e1f14` | Background of logged rows |
| `success-border` | `#14532d` | Border of logged rows |
| `warning` | `#fb923c` | Warning/swapped colour |
| `danger` (DEFAULT) | `#f87171` | Destructive and skipped colour |
| `danger-bg` | `rgba(239,68,68,0.12)` | Background of danger surfaces |
| `danger-border` | `rgba(239,68,68,0.35)` | Border of danger surfaces |

PWA and browser chrome: the manifest `theme_color` and `background_color` are both `#000000`, and `<meta name="theme-color">` in `index.html` is `#000000`.

Status badges (`StatusBadge`) use their own literal colours: done `#4ade80`, PR `#facc15` (yellow), skipped `#f87171`, swapped `#fb923c`, each on a 12-15% tinted background with a 35-40% border.

## Typography

Fonts are loaded from Google Fonts in `index.html`.

- Space Grotesk (`font-display`, weights 500, 600, 700): headings and sheet titles, typically bold, italic and uppercase (page titles use `font-display font-bold italic text-2xl uppercase`; the Today title uses 26px; bottom sheet titles use `font-bold text-base uppercase italic`). Non-mono chips also use it.
- JetBrains Mono (`font-mono`, weights 500, 600, 700): numbers, weights, the rest timer, date pill, mono chips and plate lists.
- Body text uses Tailwind's default `font-sans`; there is no custom sans token.

Size scale in use: arbitrary sizes 9px (badges, small labels), 10px (micro-labels), 11px (chips, small buttons, date pill), 13px (secondary mono values), plus Tailwind `text-xs`, `text-sm`, `text-base`, `text-lg` and `text-2xl`. Large display numbers: rest timer 34px, plate calculator target 26px, Today title 26px, other page titles `text-2xl`.

Micro-label style (`MicroLabel`): 10px, bold, uppercase, `tracking-[0.06em]`, `text-text-muted` (or `text-text-faint` when muted).

## Spacing, radius, shape, shadow

- Page padding: `p-4 pb-24` on the scrolling content area (the extra bottom padding clears the fixed nav).
- Card padding: `p-3.5`; border: 1px hairline in `border`.
- Radius: `rounded-card` 12px for cards and rows; `rounded-pill` 999px for chips, date pill, switches and the rest timer button; `rounded-lg` and `rounded-md` for buttons and the segmented control; `rounded-t-[20px]` for the top of the bottom sheet; `rounded-2xl` for the expanded rest timer panel.
- Shadows (`boxShadow` tokens):

| Token | Value | Used by |
|---|---|---|
| `shadow-menu` | `0 12px 30px rgba(0,0,0,0.5)` | Dropdown menu in the Today view |
| `shadow-fab` | `0 8px 20px rgba(0,0,0,0.4)` | Rest timer button |
| `shadow-timer` | `0 12px 30px rgba(0,0,0,0.45)` | Expanded rest timer panel |

The Today tab in the nav has its own glow, `shadow-[0_8px_22px_rgba(59,130,246,0.55)]`.

## Component patterns

- Bottom nav (`App.tsx`): fixed, z-50, background `rgba(0,0,0,0.92)` with `backdrop-blur-md`, 1px top border, bottom padding `max(0.5rem, env(safe-area-inset-bottom))`. Five tabs in order: History, Log, Today, Trends, Settings. Today is a raised 56px (`w-14 h-14`) accent circle with the glow above and a white icon, always filled. The other four show an icon (inactive colour `#8e8e93`, active `#ffffff`) and a small accent dot under the icon when active.
- BottomSheet: z-55, scrim `bg-black/70`, surface background, `border-border-input` top edge, top radius 20px, uppercase italic display title, a close button. Closes on Escape, the browser back gesture and a backdrop tap.
- Plate calculator: lives in a BottomSheet. Bar-weight chips (mono `Pill`s) in a horizontally scrolling row, a 26px mono accent target, and a per-side plate list in mono. Plate sets: lbs 45, 35, 25, 10, 5, 2.5; kg 25, 20, 15, 10, 5, 2.5, 1.25.
- Rest timer: a 48px circular button (`bg-[#1a1a1e]`, `border-pill`, `accent-light` icon, `shadow-fab`) at the right, z-40, that expands to a full-width panel (`rounded-2xl`, `shadow-timer`) with a 34px mono countdown, user-configurable `+` increment buttons (default 30s, 60s, 90s) and a pulsing green dot while running. On finish it plays an 880 Hz sine beep and vibrates `[200, 100, 200]` where supported.
- PR moment: when a logged set beats an earlier best and the confetti setting is on (`onyx_show_confetti` is not `false`), canvas-confetti fires with `particleCount: 150`, `spread: 70`, `origin: { y: 0.6 }`, colours `#22c55e`, `#ffffff`, `#fbbf24`. A PR `StatusBadge` marks the exercise.
- UI primitives in `src/components/ui/`: `Card` (surface or `alt`), `Pill` (filled accent when active, dark bordered otherwise), `SegmentedToggle`, `StatusBadge`, `SuccessRow` (green logged row with a check), `ToggleSwitch` (iOS-style, 40x22 track, 18px knob), `MicroLabel`, `DatePill`, `EmptyChartState` (dashed border, faint italic text), `BottomSheet`.
- Toast and offline banner: both sit in a fixed z-[70] column at the top. The banner is an amber strip shown while offline; toasts auto-dismiss after 5 seconds and are zinc (info) or red (error).
- ConfirmModal: centred dialog at z-[60] (above sheets), `bg-black/80` with blur, one OK button (alert mode) or Cancel/Confirm, with a destructive variant.
- Trends chart: accent-light line `#60a5fa` (2.2 stroke) over a `#3b82f6` area fade from 0.35 to 0 opacity, points filled `#111114`.

## Motion

Only the following exists:

- `transition-colors` on chips, segmented options and some buttons; `transition-transform` on chevrons; the toggle knob slides with `transition-[left] duration-150`.
- `animate-pulse` on loading text, the reconnect screen and the running rest timer dot.
- Confetti on a personal record.
- `backdrop-blur` on the nav, toasts and ConfirmModal scrim (a visual effect, not an animation).
- `animate-fade-in` is used on the rest timer, toasts, ConfirmModal and Settings, but it is not defined in `tailwind.config.js` or any CSS, so it currently produces no animation.

There is no `prefers-reduced-motion` handling in app code (the only occurrence is in `src/App.css`, an unused Vite template file).

## Dark and light

The app is dark only. There is no `darkMode` config, no `dark:` variants, no `prefers-color-scheme` handling and no light tokens. The only colour-scheme hint is `[color-scheme:dark]` on the date input, and the iOS status bar is `black-translucent`. A light theme would be new design work needing a user-approved token set; it is not documented here.

## When changing the UI

- Use the tokens above rather than literal colours, and reuse the primitives in `src/components/ui`.
- Keep the dark identity: black background, hairline borders, one blue accent, mono numbers.
- Design mobile-first at 390x844, then check desktop width.
- Match the subject: logging mid-set must stay fast and glanceable (large targets, big numbers, few steps).
- If the look changes, update this document in the same PR.
- Follow the universal design rules that apply across projects.

## Known deviations (as built)

These literals exist in the code today; this list records them and is not an instruction to change them.

- `#141416` (18 uses): chip, input and button fill.
- `#1a1a1e` (8 uses): button and filter fills, rest timer button.
- `#18181b` (1 use): `SegmentedToggle` track.
- `#1e3a5f` (2 uses): avatar fill in Settings.
- `rgba(...)` literals in the nav bar, the Today glow, the rest timer panel and the `SuccessRow` check circle.
- `#8e8e93` and `#ffffff` for the nav icon colours.
- Hardcoded hexes in `StatusBadge`, `ToggleSwitch` (`#3b82f6` / `#3f3f46`), the Trends chart and the confetti.
- `src/App.css` (unused Vite template) contains leftovers such as `#646cffaa`.
- `AuthPage`, `ConfirmModal`, `Toast` and the offline banner in `App.tsx` use stock Tailwind zinc, red, amber, blue and white classes instead of the tokens.
