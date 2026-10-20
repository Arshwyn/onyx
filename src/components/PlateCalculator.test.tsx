import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlateCalculator from './PlateCalculator';

describe('PlateCalculator', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<PlateCalculator isOpen={false} onClose={() => {}} initialWeight={225} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('computes per-side plates for a standard 45lb bar', () => {
    render(<PlateCalculator isOpen={true} onClose={() => {}} initialWeight={225} unit="lbs" />);

    // (225 - 45) / 2 = 90 per side -> two 45s (largest-first greedy), and nothing else
    expect(screen.getByText('× 2 per side')).toBeInTheDocument();
    expect(screen.queryByText('10 lbs')).not.toBeInTheDocument();
  });

  it('drops a sub-2.5lb remainder without an extra row', () => {
    render(<PlateCalculator isOpen={true} onClose={() => {}} initialWeight={226} unit="lbs" />);

    // (226 - 45) / 2 = 90.5 per side -> only the 45x2 row; the 0.5 leftover isn't representable
    expect(screen.getByText('× 2 per side')).toBeInTheDocument();
    expect(screen.queryByText(/micro-load/)).not.toBeInTheDocument();
  });

  it('switches to the kg bar-weight quick-select when unit is kg', () => {
    render(<PlateCalculator isOpen={true} onClose={() => {}} initialWeight={100} unit="kg" />);

    expect(screen.getByRole('button', { name: '20 kg' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '15 kg' })).toBeInTheDocument();
  });

  it('shows a zero-count row when target equals bar weight', () => {
    render(<PlateCalculator isOpen={true} onClose={() => {}} initialWeight={45} unit="lbs" />);

    expect(screen.getByText('0 lbs')).toBeInTheDocument();
    expect(screen.getByText('× 0 per side')).toBeInTheDocument();
  });

  it('recomputes the breakdown when a different bar weight chip is selected', async () => {
    const user = userEvent.setup();
    render(<PlateCalculator isOpen={true} onClose={() => {}} initialWeight={135} unit="lbs" />);

    // Default bar (45): (135-45)/2 = 45 per side -> just a single 45, no 10lb plate needed
    expect(screen.queryByText('10 lbs')).not.toBeInTheDocument();

    // Switch to a 15lb bar: (135-15)/2 = 60 per side -> 45 + 10 + 5
    await user.click(screen.getByRole('button', { name: '15 lbs' }));
    expect(screen.getByText('10 lbs')).toBeInTheDocument();
  });

  it('offers a "None" bar option for plate-loaded machines with no bar weight to subtract', async () => {
    const user = userEvent.setup();
    render(<PlateCalculator isOpen={true} onClose={() => {}} initialWeight={10} unit="lbs" />);

    await user.click(screen.getByRole('button', { name: 'None' }));

    expect(screen.getByText('0 lbs bar + plates per side')).toBeInTheDocument();
    // (10 - 0) / 2 = 5 per side -> a single 5lb plate
    expect(screen.getByText('5 lbs')).toBeInTheDocument();
    expect(screen.getByText('× 1 per side')).toBeInTheDocument();
  });

  it('shows a message instead of a breakdown when the target is below the bar weight', () => {
    render(<PlateCalculator isOpen={true} onClose={() => {}} initialWeight={30} unit="lbs" />);

    // Default bar is 45lb, which is above the 30lb target -- the subtitle still
    // renders ("...bar + plates per side"), but no breakdown row should.
    expect(screen.getByText('Target is below the bar weight.')).toBeInTheDocument();
    expect(screen.queryByText(/×.*per side/)).not.toBeInTheDocument();
  });

  it('resets the selected bar weight to the new unit\'s default when unit changes while open', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PlateCalculator isOpen={true} onClose={() => {}} initialWeight={100} unit="lbs" />);

    await user.click(screen.getByRole('button', { name: 'None' }));
    expect(screen.getByText('0 lbs bar + plates per side')).toBeInTheDocument();

    rerender(<PlateCalculator isOpen={true} onClose={() => {}} initialWeight={100} unit="kg" />);

    // Should reset to the kg default (20), not carry over the lbs selection of 0
    expect(screen.getByText('20 kg bar + plates per side')).toBeInTheDocument();
  });
});
