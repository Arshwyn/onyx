import { supabase } from './supabaseClient';
import { emitError, emitInfo } from './lib/toastBus';
import { enqueueWrite, getQueuedWrites, removeQueuedWrite } from './lib/writeQueue';
import type {
    Exercise, Routine, WorkoutLog, CardioLog, BodyWeight,
    Circumference, UserSettings, ExerciseStat, SetEntry
} from './types';
import type { LastSession } from './lib/progression';

type Id = string | number;

// getUser() itself resolves ok (no throw) even offline — the Postgrest/Auth
// clients catch fetch failures internally — but auth.getUser() revalidates
// against the server, so offline it resolves with `user: null`. Fall back to
// the locally persisted session (auth.getSession(), no network round trip
// unless the token is actually expired) so writes made while offline still
// get a real user_id to enqueue and later replay.
const getUser = async (): Promise<string | undefined> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user.id;

    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id;
};

// Generic localStorage-backed cache used to keep read-mostly/date-scoped
// data usable offline — the exercise picker (WorkoutLogger, DailyView,
// RoutineManager) and the Today view (routines, PRs/last sets, today's
// logs) would otherwise be empty while offline even though a write made in
// that state queues and syncs fine (see performWrite). Not scoped per-user
// (same simplification as the onyx_unit_*/onyx_show_* settings cache
// already in localStorage) — this is a single-user-per-device app. Every
// cache here is best-effort: it can go stale between syncs, which is an
// acceptable tradeoff for "there's something to look at/act on" against
// read-mostly, rarely-changing data (exercises, routines) or data that's
// only ever consulted as a fallback when a live fetch already failed
// (daily view snapshots, exercise stats).
const readCache = <T,>(key: string): T | null => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
};

const writeCache = (key: string, value: unknown): void => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Best-effort — e.g. private browsing / storage quota. Caching is a
        // convenience for offline use, not required for the app to work.
    }
};

const EXERCISES_CACHE_KEY = 'onyx_exercises_cache';

export const getExercises = async (): Promise<Exercise[]> => {
    const [globalRes, customRes] = await Promise.all([
        supabase.from('global_exercises').select('*'),
        supabase.from('custom_exercises').select('*')
    ]);

    if (globalRes.error || customRes.error) {
        console.error('Error fetching exercises:', globalRes.error || customRes.error);
        const cached = readCache<Exercise[]>(EXERCISES_CACHE_KEY);
        if (cached) return cached;
        emitError('Could not load exercises.');
        return [];
    }

    const global: Exercise[] = globalRes.data || [];
    const custom: Exercise[] = (customRes.data || []).map((e: Exercise) => ({ ...e, id: String(e.id) }));

    const allExercises = [...global, ...custom].sort((a, b) => a.name.localeCompare(b.name));

    writeCache(EXERCISES_CACHE_KEY, allExercises);
    return allExercises;
};

// --- Offline write queue -----------------------------------------------
//
// Every mutation below goes through performWrite(), which tries the write
// and, if it fails specifically because the client is offline (rather than
// a genuine server-side rejection), persists it via writeQueue.ts instead of
// discarding it. flushWriteQueue() replays the queue — in the same order it
// was built, stopping at the first still-failing entry — once connectivity
// returns (see the 'online' listener in App.tsx).
//
// Each handler is registered under a stable string `type` (also the queue
// entry's replay key), so it's the single definition used both for the live
// call and for replay — no duplicated Supabase call logic.
type WriteResponse = { data: unknown; error: { message?: string; code?: string } | null; status?: number };

interface RoutinePayload {
    user_id: string | undefined;
    days: string[];
    name: string;
    exercises: Routine['exercises'];
    cardio: NonNullable<Routine['cardio']>;
}

const writeHandlers = {
    addExercise: ([name, userId, mechanic]: [string, string | undefined, Exercise['mechanic']]) =>
        supabase.from('custom_exercises').insert([{ user_id: userId, name, category: 'Custom', mechanic: mechanic ?? null }]).select(),

    deleteCustomExercise: ([id]: [Id]) =>
        supabase.from('custom_exercises').delete().eq('id', id),

    saveRoutineUpdate: ([id, payload]: [Id, RoutinePayload]) =>
        supabase.from('routines').update(payload).eq('id', id).select(),

    saveRoutineInsert: ([payload]: [RoutinePayload]) =>
        supabase.from('routines').insert([payload]).select(),

    deleteRoutine: ([id]: [Id]) =>
        supabase.from('routines').delete().eq('id', id),

    addLog: ([date, exerciseId, sets, userId]: [string, Id, SetEntry[], string | undefined]) =>
        supabase.from('workout_logs').insert([{
            user_id: userId, date, exercise_id: String(exerciseId), sets
        }]).select(),

    deleteLog: ([id]: [Id]) =>
        supabase.from('workout_logs').delete().eq('id', id),

    updateLog: ([id, sets, date]: [Id, SetEntry[], string]) =>
        supabase.from('workout_logs').update({ sets, date }).eq('id', id).select(),

    addBodyWeight: ([weight, date, userId]: [string | number, string, string | undefined]) =>
        supabase.from('body_weights').insert([{ user_id: userId, date, weight }]).select(),

    deleteBodyWeight: ([id]: [Id]) =>
        supabase.from('body_weights').delete().eq('id', id),

    addCardioLog: ([date, type, duration, distance, userId]: [string, string, string | number, string | number | null, string | undefined]) =>
        supabase.from('cardio_logs').insert([{ user_id: userId, date, type, duration, distance }]).select(),

    deleteCardioLog: ([id]: [Id]) =>
        supabase.from('cardio_logs').delete().eq('id', id),

    updateCardioLog: ([id, date, type, duration, distance]: [Id, string, string, string | number, string | number | null | undefined]) =>
        supabase.from('cardio_logs').update({ date, type, duration, distance }).eq('id', id).select(),

    addCircumference: ([date, bodyPart, measurement, userId]: [string, string, string | number, string | undefined]) =>
        supabase.from('circumferences').insert([{ user_id: userId, date, body_part: bodyPart, measurement }]).select(),

    deleteCircumference: ([id]: [Id]) =>
        supabase.from('circumferences').delete().eq('id', id),

    updateUserSettings: ([settings, userId]: [Partial<UserSettings>, string]) =>
        supabase.from('user_settings').upsert({ user_id: userId, ...settings }),

    setDailyOverride: ([date, routineId, userId]: [string, Id, string | undefined]) =>
        supabase.from('daily_overrides').upsert({ user_id: userId, date, routine_id: routineId }),

    removeDailyOverride: ([date, userId]: [string, string | undefined]) =>
        supabase.from('daily_overrides').delete().eq('user_id', userId).eq('date', date),
};

type WriteType = keyof typeof writeHandlers;

// A fetch-level failure (offline, DNS, timeout, ...) resolves with status 0
// — see postgrest-js's PostgrestBuilder, which catches it rather than
// throwing. That's a more precise signal than navigator.onLine alone (kept
// as a fallback for parity with the rest of the app's offline handling), and
// it's what distinguishes "couldn't reach the server" from a genuine
// server-side rejection (validation, RLS, conflict) that shouldn't be queued.
const isNetworkError = (status: number | undefined): boolean => status === 0 || !navigator.onLine;

const runHandler = async (type: WriteType, args: unknown[]): Promise<WriteResponse> => {
    try {
        return await (writeHandlers[type] as unknown as (args: unknown[]) => Promise<WriteResponse>)(args);
    } catch (err) {
        return { data: null, error: err instanceof Error ? { message: err.message } : { message: String(err) } };
    }
};

const performWrite = async (type: WriteType, args: unknown[], errorMessage: string): Promise<unknown> => {
    const { data, error, status } = await runHandler(type, args);

    if (error) {
        if (isNetworkError(status)) {
            await enqueueWrite(type, args);
            emitInfo('Saved offline — will sync automatically when back online.');
            return null;
        }
        console.error(error);
        emitError(errorMessage);
    }

    return data;
};

// Replays queued writes in the order they were made. Stops at the first
// entry that still fails for network reasons (preserves order, retried on
// the next flush); a queued entry that fails for a genuine server-side
// reason on replay is dropped rather than retried forever.
// App.tsx can call this from both a mount-time check and the 'online' event
// listener, which can otherwise race (e.g. a flaky reconnect firing multiple
// 'online' events) — two concurrent flushes reading the same queue snapshot
// before either removes an entry would replay (double-submit) it. This guard
// makes an overlapping call a no-op rather than a duplicate replay.
let isFlushing = false;

export const flushWriteQueue = async (): Promise<void> => {
    if (isFlushing) return;
    isFlushing = true;

    try {
        const entries = await getQueuedWrites();
        let syncedCount = 0;

        for (const entry of entries) {
            const handler = writeHandlers[entry.type as WriteType];
            if (!handler) { await removeQueuedWrite(entry.id); continue; }

            const { error, status } = await runHandler(entry.type as WriteType, entry.args);

            if (error) {
                if (isNetworkError(status)) break;
                console.error(error);
                emitError('A queued change could not be synced and was discarded.');
                await removeQueuedWrite(entry.id);
                continue;
            }

            await removeQueuedWrite(entry.id);
            syncedCount++;
        }

        if (syncedCount > 0) {
            emitInfo(`Synced ${syncedCount} offline change${syncedCount === 1 ? '' : 's'}.`);
            // Views may have applied an optimistic local update in place of
            // a refetch that couldn't reach the server while offline (see
            // e.g. DailyView/TrendsView's measurement/cardio/weight
            // handlers) — this reconciles that local guess with real data
            // now that a sync actually went through. Pre-existing event:
            // DailyView already listens for it (see toastBus.ts's comment),
            // nothing previously dispatched it.
            window.dispatchEvent(new Event('onyx-sync-complete'));
        }
    } finally {
        isFlushing = false;
    }
};
// -------------------------------------------------------------------------

export const addExercise = async (name: string, mechanic: Exercise['mechanic'] = null) => {
    const userId = await getUser();
    return performWrite('addExercise', [name, userId, mechanic], 'Could not save exercise.');
};

export const deleteCustomExercise = async (id: Id) => {
    if (String(id).startsWith('ex_')) return;
    await performWrite('deleteCustomExercise', [id], 'Could not delete exercise.');
};

const ROUTINES_CACHE_KEY = 'onyx_routines_cache';

export const getRoutines = async (): Promise<Routine[]> => {
    const { data, error } = await supabase.from('routines').select('*');

    if (error) {
        console.error('Error fetching routines:', error);
        const cached = readCache<Routine[]>(ROUTINES_CACHE_KEY);
        if (cached) return cached;
        emitError('Could not load routines.');
        return [];
    }

    const routines = data || [];
    writeCache(ROUTINES_CACHE_KEY, routines);
    return routines;
};

interface RoutineInput {
    id?: Id | null;
    days: string[];
    name: string;
    exercises: Routine['exercises'];
    cardio?: Routine['cardio'];
}

// Both writeHandlers below chain .select(), so a successful write resolves
// to the affected row(s) as an array (empty/absent only when the write was
// queued offline -- see performWrite) -- typed here so callers (e.g.
// RoutineManager's quick-add, which needs the new row's generated id) don't
// each need their own cast of performWrite's otherwise-unknown return.
export const saveRoutine = async (routine: RoutineInput): Promise<Routine[] | null> => {
    const userId = await getUser();
    const payload: RoutinePayload = {
        user_id: userId,
        days: routine.days,
        name: routine.name,
        exercises: routine.exercises,
        cardio: routine.cardio || []
    };

    if (routine.id) {
        return performWrite('saveRoutineUpdate', [routine.id, payload], 'Could not save routine.') as Promise<Routine[] | null>;
    } else {
        return performWrite('saveRoutineInsert', [payload], 'Could not save routine.') as Promise<Routine[] | null>;
    }
};

export const deleteRoutine = async (id: Id) => {
    await performWrite('deleteRoutine', [id], 'Could not delete routine.');
};

export const getLogs = async (): Promise<WorkoutLog[]> => {
    const { data, error } = await supabase.from('workout_logs').select('*');
    if (error) { console.error('Error fetching logs:', error); emitError('Could not load workout logs.'); }
    return data || [];
};

export const addLog = async (date: string, exerciseId: Id, sets: SetEntry[]) => {
    const userId = await getUser();
    return performWrite('addLog', [date, exerciseId, sets, userId], 'Could not save workout log.');
};

export const deleteLog = async (id: Id) => {
    await performWrite('deleteLog', [id], 'Could not delete workout log.');
};

export const updateLog = async (log: WorkoutLog) => {
    return performWrite('updateLog', [log.id, log.sets, log.date], 'Could not update workout log.');
};

// Server-side PR + last-session aggregation for a scoped set of exercises,
// backed by the get_exercise_stats Postgres function (see CLAUDE.md) —
// avoids pulling the full workout_logs table just to compute these stats.
// Cache key intentionally omits beforeDate (normally "today", so it changes
// every day) — keying on just the exercise id set means a fetch made on any
// prior day still serves as a same-routine fallback while offline, at the
// cost of the PR/last-session numbers being very slightly stale in the rare
// case something relevant happened between the cached beforeDate and today.
// That's the acceptable tradeoff every cache in this file makes.
const exerciseStatsCacheKey = (exerciseIds: Id[]) => `onyx_exercise_stats_cache_${exerciseIds.map(String).sort().join(',')}`;

export const getExerciseStats = async (exerciseIds: Id[], beforeDate: string): Promise<ExerciseStat[]> => {
    if (exerciseIds.length === 0) return [];
    const { data, error } = await supabase.rpc('get_exercise_stats', {
        p_exercise_ids: exerciseIds.map(String),
        p_before_date: beforeDate
    });

    if (error) {
        console.error('Error fetching exercise stats:', error);
        const cached = readCache<ExerciseStat[]>(exerciseStatsCacheKey(exerciseIds));
        if (cached) return cached;
        emitError('Could not load exercise stats.');
        return [];
    }

    const stats = data || [];
    writeCache(exerciseStatsCacheKey(exerciseIds), stats);
    return stats;
};

// getExerciseStats' RPC only returns a best-set summary (pr_weight,
// last_weight, last_reps), which can't answer "was the target rep range hit
// on every set" — that needs the prior session's full sets[]. Changing the
// RPC's return shape would force a drop/recreate of a live Postgres function
// this repo doesn't own (see CLAUDE.md), so this is a second, plain read
// instead, scoped to the same exercise ids and a lookback window rather than
// the whole table. Same cache-key convention as exerciseStatsCacheKey above
// — omits beforeDate so a fetch from any prior day still serves as an
// offline fallback for the same routine.
const lastSessionSetsCacheKey = (exerciseIds: Id[]) => `onyx_last_sets_cache_${exerciseIds.map(String).sort().join(',')}`;

// Computed entirely in UTC (Date.UTC / getUTCDate / toISOString) rather than
// mixing UTC parsing with local-time getDate()/setDate() mutation — the
// latter can shift the computed boundary by a day across a DST transition
// that falls inside the lookback window.
const daysBefore = (dateStr: string, days: number): string => {
    const d = new Date(dateStr);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
};

export const getLastSessionSets = async (
    exerciseIds: Id[],
    beforeDate: string,
    lookbackDays = 120
): Promise<Record<string, LastSession>> => {
    if (exerciseIds.length === 0) return {};

    const { data, error } = await supabase
        .from('workout_logs')
        .select('exercise_id,date,sets')
        .in('exercise_id', exerciseIds.map(String))
        .gte('date', daysBefore(beforeDate, lookbackDays))
        .lt('date', beforeDate)
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching last session sets:', error);
        const cached = readCache<Record<string, LastSession>>(lastSessionSetsCacheKey(exerciseIds));
        if (cached) return cached;
        emitError('Could not load last session data.');
        return {};
    }

    // Rows arrive newest-first, so the first non-skipped row with real set
    // data seen per exercise is that exercise's most recent real session —
    // a skip marker (see DailyView's handleSkipExercise) stores sets as
    // [{ isSkipped: true }], and an empty sets[] carries nothing to suggest
    // from either, so both are treated the same way here.
    const result: Record<string, LastSession> = {};
    for (const row of (data || []) as { exercise_id: string; date: string; sets: SetEntry[] }[]) {
        if (result[row.exercise_id]) continue;
        if (!row.sets?.length || row.sets[0]?.isSkipped) continue;
        result[row.exercise_id] = { date: row.date, sets: row.sets };
    }

    writeCache(lastSessionSetsCacheKey(exerciseIds), result);
    return result;
};

// Throws rather than swallowing (see the legacy *ByDate/getRecent*
// functions below for the same convention) — TrendsView needs to
// distinguish a genuinely empty result from a failed fetch that fell back
// to one, so it can keep existing data on screen instead of wiping it (see
// #23). Every call site is responsible for its own try/catch + emitError.
export const getBodyWeights = async (): Promise<BodyWeight[]> => {
    const { data, error } = await supabase.from('body_weights').select('*');
    if (error) throw error;
    return data || [];
};

export const addBodyWeight = async (weight: string | number, date: string) => {
    const userId = await getUser();
    return performWrite('addBodyWeight', [weight, date, userId], 'Could not save body weight.');
};

export const deleteBodyWeight = async (id: Id) => {
    await performWrite('deleteBodyWeight', [id], 'Could not delete body weight entry.');
};

export const getCardioLogs = async (): Promise<CardioLog[]> => {
    const { data, error } = await supabase.from('cardio_logs').select('*');
    if (error) { console.error(error); emitError('Could not load cardio logs.'); }
    return data || [];
};

export const addCardioLog = async (date: string, type: string, duration: string | number, distance: string | number | null) => {
    const userId = await getUser();
    await performWrite('addCardioLog', [date, type, duration, distance, userId], 'Could not save cardio log.');
    return await getCardioLogs();
};

export const deleteCardioLog = async (id: Id) => {
    await performWrite('deleteCardioLog', [id], 'Could not delete cardio log.');
    return await getCardioLogs();
};

export const updateCardioLog = async (log: CardioLog) => {
    await performWrite('updateCardioLog', [log.id, log.date, log.type, log.duration, log.distance], 'Could not update cardio log.');
    return await getCardioLogs();
};

// Same convention as getBodyWeights above.
export const getCircumferences = async (): Promise<Circumference[]> => {
    const { data, error } = await supabase.from('circumferences').select('*');
    if (error) throw error;
    return data || [];
};

export const addCircumference = async (date: string, bodyPart: string, measurement: string | number) => {
    const userId = await getUser();
    return performWrite('addCircumference', [date, bodyPart, measurement, userId], 'Could not save measurement.');
};

export const deleteCircumference = async (id: Id) => {
    await performWrite('deleteCircumference', [id], 'Could not delete measurement.');
};

// Uses the getUser()-with-getSession()-fallback helper (not a bare
// supabase.auth.getUser()) because auth.getUser()'s network revalidation
// resolves with `user: null` while offline even though a valid local
// session exists (see getUser()'s comment above). Getting that wrong here
// previously meant an offline caller couldn't tell "not logged in" apart
// from "logged in, but the network check failed" — App.tsx's syncSettings()
// treated the latter as "this user has never saved settings" and issued a
// real (queued, then later 'synced') updateUserSettings() write with
// hardcoded defaults on every offline mount/resume, which also risked
// clobbering a real user's saved settings once that bogus write replayed.
//
// Throws on a genuine fetch failure rather than returning null for it —
// only a PGRST116 ("no rows") is a real "this user has no settings row yet"
// signal, so that's the only error case that still resolves to null;
// syncSettings()'s existing try/catch already handles the throw without
// treating it as "insert defaults." Unlike getBodyWeights/getCircumferences
// below (which always throw silently and leave emitError to their callers),
// this one still calls emitError itself for a genuine non-network failure —
// same reasoning as performWrite's isNetworkError(status) check: a fetch-level
// failure (offline, DNS, timeout — resolves with status 0 per postgrest-js,
// see isNetworkError's comment above) is expected/recoverable and shouldn't
// toast, but a real server-side rejection (RLS, malformed query) is worth
// surfacing since this is the only call site and it doesn't emit on catch.
export const getUserSettings = async (): Promise<UserSettings | null> => {
    const userId = await getUser();
    if (!userId) return null;

    const { data, error, status } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        if (!isNetworkError(status)) {
            console.error('Error fetching settings:', error);
            emitError('Could not load settings.');
        }
        throw error;
    }

    return data;
};

export const updateUserSettings = async (settings: Partial<UserSettings>) => {
    const userId = await getUser();
    if (!userId) return;

    await performWrite('updateUserSettings', [settings, userId], 'Could not save settings.');
};

export const getLogsRange = async (startDate?: string, endDate?: string): Promise<WorkoutLog[]> => {
    let query = supabase.from('workout_logs').select('*');
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    const { data, error } = await query.order('date', { ascending: false });
    if (error) { console.error(error); emitError('Could not load workout history.'); }
    return data || [];
};

export const getCardioLogsRange = async (startDate?: string, endDate?: string): Promise<CardioLog[]> => {
    let query = supabase.from('cardio_logs').select('*');
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    const { data, error } = await query.order('date', { ascending: false });
    if (error) { console.error(error); emitError('Could not load cardio history.'); }
    return data || [];
};

// ... (keep legacy functions for safety)
// These throw rather than swallow, so the caller's own catch block is
// responsible for surfacing the failure (e.g. DailyView's loadDailyView) —
// emitting here too would double up into two stacked toasts per failure.
export const getLogsByDate = async (dateStr: string): Promise<WorkoutLog[]> => {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('date', dateStr);
  if (error) throw error;
  return data;
};

export const getCardioLogsByDate = async (dateStr: string): Promise<CardioLog[]> => {
  const { data, error } = await supabase
    .from('cardio_logs')
    .select('*')
    .eq('date', dateStr);
  if (error) throw error;
  return data;
};

export const getBodyWeightByDate = async (dateStr: string): Promise<BodyWeight[]> => {
  const { data, error } = await supabase
    .from('body_weights')
    .select('*')
    .eq('date', dateStr);
  if (error) throw error;
  return data;
};

export const getCircumferencesByDate = async (dateStr: string): Promise<Circumference[]> => {
  const { data, error } = await supabase
    .from('circumferences')
    .select('*')
    .eq('date', dateStr);
  if (error) throw error;
  return data;
};

export interface DailyViewBundle {
    weights: BodyWeight[];
    cardioLogs: CardioLog[];
    logs: WorkoutLog[];
    measurements: Circumference[];
}

const dailyViewBundleCacheKey = (dateStr: string) => `onyx_daily_view_cache_${dateStr}`;

// Wraps the four throwing *ByDate reads above with a per-date fallback so
// DailyView's Today view — the thing users actually open the app for — has
// something to show offline, not just an error. Deliberately kept separate
// from getRoutines()/getExercises()/getDailyOverride() (which each cache
// themselves): those are also called directly by DailyView's post-write
// handlers (e.g. handleSaveMeasurement's own getCircumferencesByDate
// refetch), which need the real throw to distinguish "queue an optimistic
// update" from "show the normal error toast" — see DailyView.tsx. Bundling
// only here, not inside those functions themselves, keeps that contract
// intact; getDailyViewBundle is purely an additional caller, not a
// replacement.
export const getDailyViewBundle = async (dateStr: string): Promise<DailyViewBundle> => {
    const [weightsR, cardioR, logsR, measurementsR] = await Promise.allSettled([
        getBodyWeightByDate(dateStr),
        getCardioLogsByDate(dateStr),
        getLogsByDate(dateStr),
        getCircumferencesByDate(dateStr),
    ]);

    const anyRejected = [weightsR, cardioR, logsR, measurementsR].some(r => r.status === 'rejected');

    if (!anyRejected) {
        const bundle: DailyViewBundle = {
            weights: (weightsR as PromiseFulfilledResult<BodyWeight[]>).value,
            cardioLogs: (cardioR as PromiseFulfilledResult<CardioLog[]>).value,
            logs: (logsR as PromiseFulfilledResult<WorkoutLog[]>).value,
            measurements: (measurementsR as PromiseFulfilledResult<Circumference[]>).value,
        };
        writeCache(dailyViewBundleCacheKey(dateStr), bundle);
        return bundle;
    }

    console.error('Error loading daily view data for', dateStr, [weightsR, cardioR, logsR, measurementsR].filter(r => r.status === 'rejected'));

    // Merge fresh successes over the cached fallback field-by-field, rather
    // than discarding whichever of the four DID succeed this call just
    // because a sibling read failed (e.g. a one-off failure on just
    // circumferences shouldn't also serve stale weight/logs/cardio data
    // that actually just fetched fine).
    const cached = readCache<DailyViewBundle>(dailyViewBundleCacheKey(dateStr));
    const merged: DailyViewBundle = {
        weights: weightsR.status === 'fulfilled' ? weightsR.value : (cached?.weights ?? []),
        cardioLogs: cardioR.status === 'fulfilled' ? cardioR.value : (cached?.cardioLogs ?? []),
        logs: logsR.status === 'fulfilled' ? logsR.value : (cached?.logs ?? []),
        measurements: measurementsR.status === 'fulfilled' ? measurementsR.value : (cached?.measurements ?? []),
    };

    if (!cached) emitError("Could not load today's view.");
    return merged;
};

export const getRecentLogs = async (limit = 50): Promise<WorkoutLog[]> => {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
};

export const getRecentCardioLogs = async (limit = 50): Promise<CardioLog[]> => {
  const { data, error } = await supabase
    .from('cardio_logs')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
};

// `null` is itself a valid, meaningful result here ("no override for this
// date" — not "the fetch failed"), so the cache wraps it in an object
// rather than caching the raw value directly — otherwise a cache read
// couldn't tell "nothing cached yet" apart from "cached, and it was null".
const dailyOverrideCacheKey = (date: string) => `onyx_daily_override_cache_${date}`;

export const getDailyOverride = async (date: string): Promise<Id | null> => {
    const userId = await getUser();
    const { data, error } = await supabase
        .from('daily_overrides')
        .select('routine_id')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();

    if (error) {
        console.error('Error fetching override:', error);
        const cached = readCache<{ value: Id | null }>(dailyOverrideCacheKey(date));
        if (cached) return cached.value;
        emitError('Could not load routine override.');
        return null;
    }

    const routineId = data?.routine_id || null;
    writeCache(dailyOverrideCacheKey(date), { value: routineId });
    return routineId;
};

export const setDailyOverride = async (date: string, routineId: Id) => {
    const userId = await getUser();
    await performWrite('setDailyOverride', [date, routineId, userId], 'Could not save routine override.');
};

export const removeDailyOverride = async (date: string) => {
    const userId = await getUser();
    await performWrite('removeDailyOverride', [date, userId], 'Could not remove routine override.');
};
