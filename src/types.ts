import type { MechanicRepDefaults } from './lib/mechanicDefaults';

export interface SetEntry {
  // Optional because a "skipped" set marker (see DailyView's handleSkipExercise)
  // stores just `{ isSkipped: true }` with no weight/reps.
  weight?: string | number;
  reps?: string | number;
  isSkipped?: boolean;
}

export interface Exercise {
  id: string | number;
  name: string;
  category?: string;
  user_id?: string;
  mechanic?: 'compound' | 'isolation' | null;
}

export interface RoutineExerciseTarget {
  id: string | number;
  sets?: string | number;
  reps?: string | number;   // bottom of the range when repMax is set
  repMax?: string | number; // top of the range -- omit for a fixed (non-ranged) target
}

export interface CardioTemplate {
  id: string | number;
  type: string;
  duration: string | number;
  distance?: string | number;
}

export interface Routine {
  id: string | number;
  user_id?: string;
  days: string[];
  name: string;
  exercises: (RoutineExerciseTarget | string | number)[];
  cardio?: CardioTemplate[];
}

export interface WorkoutLog {
  id: string | number;
  user_id?: string;
  date: string;
  exercise_id?: string;
  exerciseId?: string;
  sets: SetEntry[];
}

export interface CardioLog {
  id: string | number;
  user_id?: string;
  date: string;
  type: string;
  duration: string | number;
  distance?: string | number | null;
}

export interface BodyWeight {
  id: string | number;
  user_id?: string;
  date: string;
  weight: string | number;
}

export interface Circumference {
  id: string | number;
  user_id?: string;
  date: string;
  body_part: string;
  measurement: string | number;
}

export interface UserSettings {
  user_id?: string;
  name?: string | null;
  weight_unit: string;
  measure_unit: string;
  distance_unit?: string;
  timer_increments: number[];
  show_timer?: boolean;
  show_confetti?: boolean;
  show_body_weight?: boolean;
  show_measurements?: boolean;
  progression_enabled?: boolean;
  progression_step?: number;
  default_bar_weight?: number;
  mechanic_rep_defaults?: MechanicRepDefaults | null;
}

export interface ExerciseStat {
  exercise_id: string;
  pr_weight?: number;
  last_date?: string;
  last_weight?: number | string;
  last_reps?: number | string;
}
