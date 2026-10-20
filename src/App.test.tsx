import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { supabase } from './supabaseClient';

vi.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: 'user-1' } } } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      refreshSession: vi.fn(() => Promise.resolve({})),
    },
    removeAllChannels: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('./dataManager', () => ({
  getUserSettings: vi.fn(() => Promise.resolve(null)),
  updateUserSettings: vi.fn(() => Promise.resolve()),
  flushWriteQueue: vi.fn(() => Promise.resolve()),
}));

vi.mock('./components/AuthPage', () => ({ default: () => <div>AuthPage</div> }));
vi.mock('./components/DailyView', () => ({ default: () => <div>DailyView</div> }));
vi.mock('./components/HistoryView', () => ({ default: () => <div>HistoryView</div> }));
vi.mock('./components/TrendsView', () => ({ default: () => <div>TrendsView</div> }));
vi.mock('./components/WorkoutLogger', () => ({ default: () => <div>WorkoutLogger</div> }));
vi.mock('./components/RestTimer', () => ({ default: () => <div>RestTimer</div> }));
vi.mock('./components/Toast', () => ({ default: () => <div>Toast</div> }));
vi.mock('./components/SettingsView', () => ({
  default: () => <div>SettingsView</div>,
}));

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );

describe('App routing', () => {
  it('renders DailyView at "/" with the Today tab active', async () => {
    renderAt('/');
    expect(await screen.findByText('DailyView')).toBeInTheDocument();
    // The bottom nav is icon-only (no visible text labels) -- tabs are
    // reached by their accessible name (aria-label) instead.
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Log' })).not.toHaveAttribute('aria-current');
  });

  it('deep-links directly into a non-default route', async () => {
    renderAt('/history');
    expect(await screen.findByText('HistoryView')).toBeInTheDocument();
  });

  it('navigates between tabs via the bottom nav', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await screen.findByText('DailyView');

    await user.click(screen.getByRole('button', { name: 'Log' }));
    expect(await screen.findByText('WorkoutLogger')).toBeInTheDocument();
    expect(screen.queryByText('DailyView')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Trends' }));
    expect(await screen.findByText('TrendsView')).toBeInTheDocument();
  });

  it('navigates to Settings via the bottom nav', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await screen.findByText('DailyView');

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByText('SettingsView')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  });

  it('redirects an unknown path back to the default route', async () => {
    renderAt('/nonexistent');
    expect(await screen.findByText('DailyView')).toBeInTheDocument();
  });
});

describe('App resume/visibility gating', () => {
  // Regression: handleVisibilityChange used to run the full "stale session"
  // recovery (clear realtime channels, force a session refresh, remount
  // DailyView via refreshKey) on *every* visibilitychange-to-visible or
  // window focus event, including a brief app-switch lasting a second or
  // two — losing whatever the user was doing (in-progress inputs, expanded
  // cards) on every trip back to the app. It should only do that after
  // being backgrounded long enough that sockets/session could plausibly
  // have actually gone stale.
  const setVisibility = (state: DocumentVisibilityState) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not run the stale-session recovery for a brief hide/show cycle', async () => {
    renderAt('/');
    await screen.findByText('DailyView');
    vi.clearAllMocks();

    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000_000);
    setVisibility('hidden');
    nowSpy.mockReturnValue(1_000_000 + 5 * 60 * 1000); // 5min later — well under the 30min threshold
    setVisibility('visible');

    // Give the (synchronous-until-the-threshold-check) async handler a tick
    // to run; it should return before ever awaiting anything.
    await Promise.resolve();

    expect(supabase.removeAllChannels).not.toHaveBeenCalled();
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
  });

  it('runs the stale-session recovery after being backgrounded past the threshold', async () => {
    renderAt('/');
    await screen.findByText('DailyView');
    vi.clearAllMocks();

    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000_000);
    setVisibility('hidden');
    nowSpy.mockReturnValue(1_000_000 + 31 * 60 * 1000); // 31min later — over the threshold
    setVisibility('visible');

    await waitFor(() => expect(supabase.removeAllChannels).toHaveBeenCalled());
    expect(supabase.auth.refreshSession).toHaveBeenCalled();
  });

  it('does not run the recovery on the very first visible/focus event if the app was never actually hidden', async () => {
    renderAt('/');
    await screen.findByText('DailyView');
    vi.clearAllMocks();

    // No preceding 'hidden' transition — e.g. a window focus event that
    // fires without the tab ever having gone through visibilitychange.
    setVisibility('visible');
    await Promise.resolve();

    expect(supabase.removeAllChannels).not.toHaveBeenCalled();
  });
});
