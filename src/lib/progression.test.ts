import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PROGRESSION_CONFIG,
  nextWeight,
  nextReps,
  setsAtMax,
  suggest,
  topWeight,
  type ExerciseTarget,
  type LastSession,
} from './progression';

const target = (overrides: Partial<ExerciseTarget> = {}): ExerciseTarget => ({
  targetSets: 3,
  repMin: 8,
  repMax: 12,
  ...overrides,
});

const session = (sets: LastSession['sets'], date = '2026-01-01'): LastSession => ({ date, sets });

describe('topWeight / setsAtMax', () => {
  it('finds the heaviest logged weight', () => {
    expect(topWeight([{ weight: 135, reps: 8 }, { weight: 185, reps: 5 }, { weight: 155, reps: 6 }])).toBe(185);
  });

  it('returns null when there are no valid sets', () => {
    expect(topWeight([])).toBeNull();
    expect(topWeight([{ isSkipped: true }])).toBeNull();
  });

  it('counts only sets at or above top weight and at or above repMax', () => {
    const sets = [{ weight: 185, reps: 12 }, { weight: 185, reps: 11 }, { weight: 155, reps: 12 }];
    expect(setsAtMax(sets, 185, 12)).toBe(1);
  });
});

describe('nextWeight', () => {
  it('steps up by the larger of +step or +2.5%', () => {
    expect(nextWeight(185, DEFAULT_PROGRESSION_CONFIG)).toBe(190);
  });

  it('still advances at least one step when 2.5% would otherwise round back to the same weight', () => {
    // 2.5% of 45 is 1.125 lbs -- rounds to 45 again at a 5 lb step without the floor.
    expect(nextWeight(45, DEFAULT_PROGRESSION_CONFIG)).toBe(50);
  });

  it('handles a zero-weight (bodyweight-tracked) baseline without producing NaN or a negative step', () => {
    // Flagged in PR #28's review as unguarded; verifying it here instead of
    // changing the formula -- 0 + step already lands on step, and 2.5% of 0
    // is 0, so max(step, 0) is step with no special-casing needed.
    expect(nextWeight(0, DEFAULT_PROGRESSION_CONFIG)).toBe(5);
  });
});

describe('nextReps', () => {
  it('pads with repMin when the last session had fewer sets than the target', () => {
    const sets = [{ weight: 100, reps: 10 }];
    expect(nextReps(sets, target({ targetSets: 3, repMin: 8, repMax: 12 }))).toEqual([11, 8, 8]);
  });

  it('truncates when the last session had more sets than the target', () => {
    const sets = [{ weight: 100, reps: 8 }, { weight: 100, reps: 8 }, { weight: 100, reps: 8 }, { weight: 100, reps: 8 }];
    expect(nextReps(sets, target({ targetSets: 3 }))).toHaveLength(3);
  });

  it('never suggests past repMax', () => {
    expect(nextReps([{ weight: 100, reps: 12 }], target({ targetSets: 1, repMin: 8, repMax: 12 }))).toEqual([12]);
  });
});

describe('suggest -- the three-session ladder (range 8-12, 3 sets, 185 lbs)', () => {
  const t = target({ targetSets: 3, repMin: 8, repMax: 12 });

  it('12,11,9 -> stay at 185, climb to 12,12,10', () => {
    const result = suggest(session([{ weight: 185, reps: 12 }, { weight: 185, reps: 11 }, { weight: 185, reps: 9 }]), t, true);
    expect(result).toMatchObject({ kind: 'ADD_REPS', weight: 185, reps: [12, 12, 10] });
  });

  it('12,12,11 -> stay at 185, climb to 12,12,12', () => {
    const result = suggest(session([{ weight: 185, reps: 12 }, { weight: 185, reps: 12 }, { weight: 185, reps: 11 }]), t, true);
    expect(result).toMatchObject({ kind: 'ADD_REPS', weight: 185, reps: [12, 12, 12] });
  });

  it('12,12,12 -> add weight, drop to 190 @ 8,8,8', () => {
    const result = suggest(session([{ weight: 185, reps: 12 }, { weight: 185, reps: 12 }, { weight: 185, reps: 12 }]), t, true);
    expect(result).toMatchObject({ kind: 'ADD_WEIGHT', weight: 190, from: 185, reps: [8, 8, 8] });
  });
});

describe('suggest -- ramp-up sets', () => {
  it('working up through 135/155/185 against 3x8 fixed is ADD_REPS, not ADD_WEIGHT', () => {
    const t = target({ targetSets: 3, repMin: 8, repMax: 8 });
    const last = session([{ weight: 135, reps: 8 }, { weight: 155, reps: 8 }, { weight: 185, reps: 8 }]);
    const result = suggest(last, t, true);
    expect(result.kind).toBe('ADD_REPS');
  });
});

describe('suggest -- fixed-target parity (no repMax)', () => {
  const t = target({ targetSets: 3, repMin: 10, repMax: 10 });

  it('hitting the fixed target on every set adds weight, not a rep ladder', () => {
    const last = session([{ weight: 100, reps: 10 }, { weight: 100, reps: 10 }, { weight: 100, reps: 10 }]);
    const result = suggest(last, t, true);
    expect(result).toMatchObject({ kind: 'ADD_WEIGHT', reps: [10, 10, 10] });
  });

  it('missing the fixed target keeps the same weight and never produces a non-uniform ladder', () => {
    const last = session([{ weight: 100, reps: 9 }, { weight: 100, reps: 9 }, { weight: 100, reps: 9 }]);
    const result = suggest(last, t, true);
    expect(result).toMatchObject({ kind: 'ADD_REPS', weight: 100, reps: [10, 10, 10] });
  });
});

describe('suggest -- bodyweight (zero-weight) exercises', () => {
  const t = target({ targetSets: 3, repMin: 8, repMax: 12 });

  it('maxing every set at 0 lbs holds at repMax instead of suggesting added weight', () => {
    const last = session([{ weight: 0, reps: 12 }, { weight: 0, reps: 12 }, { weight: 0, reps: 12 }]);
    const result = suggest(last, t, true);
    expect(result).toMatchObject({ kind: 'ADD_REPS', weight: 0, reps: [12, 12, 12] });
  });

  it('below repMax at 0 lbs still climbs the rep ladder like any other exercise', () => {
    const last = session([{ weight: 0, reps: 10 }, { weight: 0, reps: 9 }, { weight: 0, reps: 8 }]);
    const result = suggest(last, t, true);
    expect(result).toMatchObject({ kind: 'ADD_REPS', weight: 0, reps: [11, 10, 9] });
  });

  it('a fixed (non-ranged) bodyweight target also holds rather than adding weight', () => {
    const tFixed = target({ targetSets: 3, repMin: 15, repMax: 15 });
    const last = session([{ weight: 0, reps: 15 }, { weight: 0, reps: 15 }, { weight: 0, reps: 15 }]);
    const result = suggest(last, tFixed, true);
    expect(result).toMatchObject({ kind: 'ADD_REPS', weight: 0, reps: [15, 15, 15] });
  });

  it('adding real load to a normally-bodyweight exercise (weighted plank) still progresses weight once maxed', () => {
    const last = session([{ weight: 25, reps: 12 }, { weight: 25, reps: 12 }, { weight: 25, reps: 12 }]);
    const result = suggest(last, t, true);
    expect(result).toMatchObject({ kind: 'ADD_WEIGHT', weight: 30, from: 25 });
  });
});

describe('suggest -- edge cases', () => {
  const t = target({ targetSets: 3, repMin: 8, repMax: 12 });

  it('no prior session -> NO_GUIDANCE / NO_HISTORY, current fallback values', () => {
    expect(suggest(null, t, true)).toEqual({ kind: 'NO_GUIDANCE', reason: 'NO_HISTORY', weight: null, reps: [8, 8, 8] });
    expect(suggest(undefined, t, true)).toEqual({ kind: 'NO_GUIDANCE', reason: 'NO_HISTORY', weight: null, reps: [8, 8, 8] });
  });

  it('a skipped-set marker as the whole session -> NO_GUIDANCE, same as no history', () => {
    const last = session([{ isSkipped: true }]);
    expect(suggest(last, t, true)).toMatchObject({ kind: 'NO_GUIDANCE', reason: 'NO_HISTORY' });
  });

  it('string-typed weight/reps from form inputs parse correctly', () => {
    const last = session([{ weight: '185', reps: '12' }, { weight: '185', reps: '12' }, { weight: '185', reps: '12' }]);
    const result = suggest(last, t, true);
    expect(result).toMatchObject({ kind: 'ADD_WEIGHT', weight: 190 });
  });

  it('empty/garbage values are filtered out rather than throwing', () => {
    const last = session([{ weight: '', reps: 'abc' }, { weight: 185, reps: 12 }]);
    expect(() => suggest(last, t, true)).not.toThrow();
    expect(topWeight(last.sets)).toBe(185);
  });

  it('rejects partially-numeric strings instead of parsing their numeric prefix', () => {
    const last = session([{ weight: '185abc', reps: '12xyz' }, { weight: 185, reps: 12 }]);
    // The garbage-string set is filtered out entirely -- only the second, clean set counts.
    expect(topWeight(last.sets)).toBe(185);
    expect(setsAtMax(last.sets, 185, 12)).toBe(1);
  });

  it('disabled fallback picks the best (max) reps among sets tied at top weight, not the first', () => {
    const last = session([{ weight: 185, reps: 8 }, { weight: 185, reps: 12 }, { weight: 155, reps: 15 }]);
    const result = suggest(last, t, false);
    expect(result).toEqual({ kind: 'NO_GUIDANCE', reason: 'DISABLED', weight: 185, reps: [12, 12, 12] });
  });

  it('the 45 lb no-op guard applies through suggest() too', () => {
    const t45 = target({ targetSets: 1, repMin: 8, repMax: 8 });
    const last = session([{ weight: 45, reps: 8 }]);
    const result = suggest(last, t45, true);
    expect(result).toMatchObject({ kind: 'ADD_WEIGHT', weight: 50 });
  });

  it('regression guard: enabled=false returns today\'s fallback weight and uniform reps, unchanged', () => {
    const last = session([{ weight: 185, reps: 12 }, { weight: 185, reps: 12 }, { weight: 185, reps: 12 }]);
    const result = suggest(last, t, false);
    expect(result).toEqual({ kind: 'NO_GUIDANCE', reason: 'DISABLED', weight: 185, reps: [12, 12, 12] });
  });

  it('regression guard holds with no history either: disabled + no session falls back cleanly', () => {
    expect(suggest(null, t, false)).toEqual({ kind: 'NO_GUIDANCE', reason: 'DISABLED', weight: null, reps: [8, 8, 8] });
  });
});
