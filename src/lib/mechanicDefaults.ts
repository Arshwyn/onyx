export interface MechanicRepRange {
  sets: number;
  repMin: number;
  repMax: number;
}

export type MechanicRepDefaults = Record<'compound' | 'isolation', MechanicRepRange>;

// Built-in fallback -- compound lifts get a heavier/lower-rep range, isolation
// work a lighter/higher-rep one. Mirrors the values RoutineManager hardcoded
// before this became user-configurable (see mechanic-datafix.sql).
export const DEFAULT_MECHANIC_REP_DEFAULTS: MechanicRepDefaults = {
  compound: { sets: 3, repMin: 5, repMax: 8 },
  isolation: { sets: 3, repMin: 10, repMax: 15 },
};

const STORAGE_KEY = 'onyx_mechanic_rep_defaults';

// Reads the user's override from localStorage (mirrored from
// user_settings.mechanic_rep_defaults by App.tsx's syncSettings(), same
// pattern as onyx_unit_*/onyx_show_*), merged over the built-in default so a
// partial or corrupt override never leaves a mechanic without a usable
// range.
export const getMechanicRepDefaults = (): MechanicRepDefaults => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MECHANIC_REP_DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      compound: { ...DEFAULT_MECHANIC_REP_DEFAULTS.compound, ...parsed?.compound },
      isolation: { ...DEFAULT_MECHANIC_REP_DEFAULTS.isolation, ...parsed?.isolation },
    };
  } catch {
    return DEFAULT_MECHANIC_REP_DEFAULTS;
  }
};
