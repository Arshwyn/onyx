import { supabase } from './supabaseClient';

// --- UTILITY: RETRY WRAPPER ---
// If a request fails (e.g., zombie connection), wait 500ms and try once more.
const withRetry = async (fn, retries = 1) => {
    try {
        return await fn();
    } catch (error) {
        if (retries > 0) {
            console.warn("DB Request failed, retrying...", error);
            await new Promise(r => setTimeout(r, 500)); // Wait 500ms
            return withRetry(fn, retries - 1);
        }
        throw error;
    }
};

// --- HELPER: Get Current User ---
const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
};

// --- 1. EXERCISES ---
const DEFAULT_EXERCISES = [
    { id: 'ex_1', name: 'Squat', category: 'Legs' },
    { id: 'ex_2', name: 'Bench Press', category: 'Push' },
    { id: 'ex_3', name: 'Deadlift', category: 'Pull' },
    { id: 'ex_4', name: 'Overhead Press', category: 'Push' },
    { id: 'ex_5', name: 'Dumbbell Row', category: 'Pull' },
    { id: 'ex_6', name: 'Lunges', category: 'Legs' },
    { id: 'ex_7', name: 'Pull Up', category: 'Pull' },
    { id: 'ex_8', name: 'Dips', category: 'Push' },
    { id: 'ex_9', name: 'Lateral Raise', category: 'Push' },
    { id: 'ex_10', name: 'Bicep Curl', category: 'Pull' },
    { id: 'ex_11', name: 'Tricep Extension', category: 'Push' },
    { id: 'ex_12', name: 'Leg Press', category: 'Legs' },
    { id: 'ex_13', name: 'Leg Curl', category: 'Legs' },
    { id: 'ex_14', name: 'Calf Raise', category: 'Legs' },
    { id: 'ex_15', name: 'Face Pull', category: 'Pull' }
];

export const getExercises = async () => {
    return withRetry(async () => {
        const { data, error } = await supabase.from('custom_exercises').select('*');
        if (error) throw error;

        const custom = data || [];
        const formattedCustom = custom.map(e => ({ ...e, id: String(e.id) }));
        return [...DEFAULT_EXERCISES, ...formattedCustom];
    });
};

export const addExercise = async (name, category) => {
    const userId = await getUser();
    return withRetry(async () => {
        const { data, error } = await supabase.from('custom_exercises').insert([{ user_id: userId, name, category }]).select();
        if (error) throw error;
        return data;
    });
};

export const deleteCustomExercise = async (id) => {
    if (String(id).startsWith('ex_')) return;
    return withRetry(async () => {
        const { error } = await supabase.from('custom_exercises').delete().eq('id', id);
        if (error) throw error;
    });
};

// --- 2. ROUTINES ---
export const getRoutines = async () => {
    return withRetry(async () => {
        const { data, error } = await supabase.from('routines').select('*');
        if (error) throw error;
        return data || [];
    });
};

export const saveRoutine = async (routine) => {
    const userId = await getUser();
    const payload = {
        user_id: userId,
        day: routine.day,
        name: routine.name,
        exercises: routine.exercises,
        cardio: routine.cardio || []
    };

    return withRetry(async () => {
        if (routine.id) {
            const { data, error } = await supabase.from('routines').update(payload).eq('id', routine.id).select();
            if (error) throw error;
            return data;
        } else {
            const { data, error } = await supabase.from('routines').insert([payload]).select();
            if (error) throw error;
            return data;
        }
    });
};

export const deleteRoutine = async (id) => {
    return withRetry(async () => {
        const { error } = await supabase.from('routines').delete().eq('id', id);
        if (error) throw error;
    });
};

// --- 3. LOGS (LIFTING) ---
export const getLogs = async () => {
    return withRetry(async () => {
        const { data, error } = await supabase.from('workout_logs').select('*');
        if (error) throw error;
        return data || [];
    });
};

export const addLog = async (date, exerciseId, sets) => {
    const userId = await getUser();
    return withRetry(async () => {
        const { data, error } = await supabase.from('workout_logs').insert([{
            user_id: userId,
            date,
            exercise_id: String(exerciseId),
            sets
        }]).select();
        if (error) throw error;
        return data;
    });
};

export const deleteLog = async (id) => {
    return withRetry(async () => {
        const { error } = await supabase.from('workout_logs').delete().eq('id', id);
        if (error) throw error;
    });
};

export const updateLog = async (log) => {
    return withRetry(async () => {
        const { data, error } = await supabase.from('workout_logs').update({ sets: log.sets, date: log.date }).eq('id', log.id).select();
        if (error) throw error;
        return data;
    });
};

// --- 4. BODY WEIGHT ---
export const getBodyWeights = async () => {
    return withRetry(async () => {
        const { data, error } = await supabase.from('body_weights').select('*');
        if (error) throw error;
        return data || [];
    });
};

export const addBodyWeight = async (weight, date) => {
    const userId = await getUser();
    return withRetry(async () => {
        const { data, error } = await supabase.from('body_weights').insert([{ user_id: userId, date, weight }]).select();
        if (error) throw error;
        return data;
    });
};

export const deleteBodyWeight = async (id) => {
    return withRetry(async () => {
        const { error } = await supabase.from('body_weights').delete().eq('id', id);
        if (error) throw error;
    });
};

// --- 5. CARDIO ---
export const getCardioLogs = async () => {
    return withRetry(async () => {
        const { data, error } = await supabase.from('cardio_logs').select('*');
        if (error) throw error;
        return data || [];
    });
};

export const addCardioLog = async (date, type, duration, distance) => {
    const userId = await getUser();
    return withRetry(async () => {
        const { data, error } = await supabase.from('cardio_logs').insert([{ user_id: userId, date, type, duration, distance }]).select();
        if (error) throw error;
        return await getCardioLogs();
    });
};

export const deleteCardioLog = async (id) => {
    return withRetry(async () => {
        const { error } = await supabase.from('cardio_logs').delete().eq('id', id);
        if (error) throw error;
        return await getCardioLogs();
    });
};

export const updateCardioLog = async (log) => {
    return withRetry(async () => {
        const { data, error } = await supabase.from('cardio_logs').update({
            date: log.date,
            type: log.type,
            duration: log.duration,
            distance: log.distance
        }).eq('id', log.id).select();
        if (error) throw error;
        return await getCardioLogs();
    });
};

export const getCircumferences = async () => {
    return withRetry(async () => {
        const { data, error } = await supabase.from('circumferences').select('*');
        if (error) throw error;
        return data || [];
    });
};

export const addCircumference = async (date, bodyPart, measurement) => {
    const userId = await getUser();
    return withRetry(async () => {
        const { data, error } = await supabase.from('circumferences').insert([{ user_id: userId, date, body_part: bodyPart, measurement }]).select();
        if (error) throw error;
        return data;
    });
};

export const deleteCircumference = async (id) => {
    return withRetry(async () => {
        const { error } = await supabase.from('circumferences').delete().eq('id', id);
        if (error) throw error;
    });
};

export const getUserSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    return withRetry(async () => {
        const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    });
};

export const updateUserSettings = async (settings) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    return withRetry(async () => {
        const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, ...settings });
        if (error) throw error;
    });
};

// --- PERFORMANCE OPTIMIZATIONS ---

export const getLogsByDate = async (dateStr) => {
  return withRetry(async () => {
      const { data, error } = await supabase
        .from('workout_logs') 
        .select('*')
        .eq('date', dateStr);
      if (error) throw error;
      return data;
  });
};

export const getCardioLogsByDate = async (dateStr) => {
  return withRetry(async () => {
      const { data, error } = await supabase
        .from('cardio_logs')
        .select('*')
        .eq('date', dateStr);
      if (error) throw error;
      return data;
  });
};

export const getRecentLogs = async (limit = 50) => {
  return withRetry(async () => {
      const { data, error } = await supabase
        .from('workout_logs') 
        .select('*')
        .order('date', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
  });
};

export const getRecentCardioLogs = async (limit = 50) => {
  return withRetry(async () => {
      const { data, error } = await supabase
        .from('cardio_logs')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
  });
};