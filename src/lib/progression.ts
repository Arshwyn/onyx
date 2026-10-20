// Double progression / APRE suggestion logic (see the progression-suggestions
// plan for the evidence and worked examples this implements). Pure and
// unit-tested, same shape as toastBus.ts/writeQueue.ts in this directory —
// zero runtime imports, so it carries no risk to anything that doesn't
// import it yet.
import type { SetEntry } from '../types';

export interface ProgressionConfig {
  step: number;         // smallest practical weight jump (5 lbs / 2.5 kg)
  incrementPct: number; // 0.025 == 2.5%
}

export const DEFAULT_PROGRESSION_CONFIG: ProgressionConfig = { step: 5, incrementPct: 0.025 };

export interface LastSession {
  date: string;
  sets: SetEntry[];
}

export interface ExerciseTarget {
  targetSets: number;
  repMin: number;
  // Equal to repMin for a fixed (non-ranged) target. Unlike
  // RoutineExerciseTarget.repMax (types.ts), this is required and numeric --
  // parsing the routine's string | undefined value and defaulting an absent
  // repMax to repMin is the caller's job, not this module's.
  repMax: number;
}

export type Suggestion =
  | { kind: 'NO_GUIDANCE'; reason: 'DISABLED' | 'NO_HISTORY'; weight: number | null; reps: number[] }
  | { kind: 'ADD_WEIGHT'; weight: number; from: number; reps: number[] }
  | { kind: 'ADD_REPS'; weight: number; reps: number[]; atMax: number; targetSets: number };

// sets come from a jsonb column (string | number from a raw <input>), and
// isSkipped entries carry no weight/reps at all -- filter and parse
// defensively before any numeric comparison.
const toNumber = (value: string | number | undefined): number | null => {
  if (value === undefined || value === '') return null;
  // Number(), not parseFloat -- parseFloat silently accepts "12abc" as 12.
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

interface ValidSet { weight: number; reps: number }

const validSets = (sets: SetEntry[]): ValidSet[] =>
  sets
    .filter((s) => !s.isSkipped)
    .map((s) => ({ weight: toNumber(s.weight), reps: toNumber(s.reps) }))
    .filter((s): s is ValidSet => s.weight !== null && s.reps !== null);

export const topWeight = (sets: SetEntry[]): number | null => {
  const valid = validSets(sets);
  return valid.length === 0 ? null : Math.max(...valid.map((s) => s.weight));
};

export const setsAtMax = (sets: SetEntry[], top: number, repMax: number): number =>
  validSets(sets).filter((s) => s.weight >= top && s.reps >= repMax).length;

// The reps performed at the heaviest set of a session -- the closest pure
// equivalent of "last weight, last reps" for the NO_GUIDANCE fallback, since
// top is by definition one of the weights actually logged. Takes the best
// (max) reps among sets tied at that weight, not just the first one.
const repsAtTopWeight = (sets: SetEntry[], top: number): number | null => {
  const matches = validSets(sets).filter((s) => s.weight === top);
  return matches.length === 0 ? null : Math.max(...matches.map((s) => s.reps));
};

const roundToStep = (value: number, step: number): number => Math.round(value / step) * step;

export const nextWeight = (from: number, config: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG): number => {
  const { step, incrementPct } = config;
  // max() is what stops light accessory lifts from getting a no-op
  // suggestion -- 2.5% of 45 lbs rounds back to 45 at a 5 lb step on its own.
  return Math.max(from + step, roundToStep(from * (1 + incrementPct), step));
};

export const nextReps = (sets: SetEntry[], target: ExerciseTarget): number[] => {
  const reps = validSets(sets).map((s) => Math.min(s.reps + 1, target.repMax));
  while (reps.length < target.targetSets) reps.push(target.repMin);
  return reps.slice(0, target.targetSets);
};

export const suggest = (
  last: LastSession | null | undefined,
  target: ExerciseTarget,
  enabled: boolean,
  config: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG
): Suggestion => {
  const uniform = (weight: number | null): number[] => {
    const reps = weight !== null ? repsAtTopWeight(last!.sets, weight) : null;
    return Array(target.targetSets).fill(reps ?? target.repMin);
  };

  if (!enabled) {
    const top = last ? topWeight(last.sets) : null;
    return { kind: 'NO_GUIDANCE', reason: 'DISABLED', weight: top, reps: uniform(top) };
  }

  const top = last ? topWeight(last.sets) : null;
  if (top === null) {
    return {
      kind: 'NO_GUIDANCE',
      reason: 'NO_HISTORY',
      weight: null,
      reps: Array(target.targetSets).fill(target.repMin),
    };
  }

  const atMax = setsAtMax(last!.sets, top, target.repMax);
  // A zero-weight top means the exercise was logged as pure bodyweight (see
  // Plank/Crunch/Leg Raise in practice) -- suggesting "+5 lbs" for those is
  // nonsensical. Real bodyweight progression is reps-only up to the
  // routine's own repMax ceiling, then holds there; it never escalates to
  // suggesting external load on its own. Skip straight to the ADD_REPS
  // branch below, which already saturates at repMax for this case.
  if (atMax >= target.targetSets && top > 0) {
    return {
      kind: 'ADD_WEIGHT',
      weight: nextWeight(top, config),
      from: top,
      reps: Array(target.targetSets).fill(target.repMin),
    };
  }

  return {
    kind: 'ADD_REPS',
    weight: top,
    reps: nextReps(last!.sets, target),
    atMax,
    targetSets: target.targetSets,
  };
};
