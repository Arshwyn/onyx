import { supabase } from './supabaseClient';

const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
};

export const getExercises = async () => {
    const [globalRes, customRes] = await Promise.all([
        supabase.from('global_exercises').select('*'),
        supabase.from('custom_exercises').select('*')
    ]);

    const global = globalRes.data || [];
    const custom = (customRes.data || []).map(e => ({ ...e, id: String(e.id) }));

    const allExercises = [...global, ...custom];
    
    return allExercises.sort((a, b) => a.name.localeCompare(b.name));
};

export const addExercise = async (name) => {
    const userId = await getUser();
    const { data, error } = await supabase.from('custom_exercises').insert([{
        user_id: userId,
        name,
        category: 'Custom'
    }]).select();

    if (error) console.error(error);
    return data;
};

export const deleteCustomExercise = async (id) => {
    if (String(id).startsWith('ex_')) return;
    const { error } = await supabase.from('custom_exercises').delete().eq('id', id);
    if (error) console.error(error);
};

export const getRoutines = async () => {
    const { data, error } = await supabase.from('routines').select('*');
    if (error) console.error('Error fetching routines:', error);
    return data || [];
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

    if (routine.id) {
        const { data, error } = await supabase.from('routines').update(payload).eq('id', routine.id).select();
        if (error) console.error(error);
        return data;
    } else {
        const { data, error } = await supabase.from('routines').insert([payload]).select();
        if (error) console.error(error);
        return data;
    }
};

export const deleteRoutine = async (id) => {
    const { error } = await supabase.from('routines').delete().eq('id', id);
    if (error) console.error(error);
};

export const getLogs = async () => {
    const { data, error } = await supabase.from('workout_logs').select('*');
    if (error) console.error('Error fetching logs:', error);
    return data || [];
};

export const addLog = async (date, exerciseId, sets) => {
    const userId = await getUser();
    const { data, error } = await supabase.from('workout_logs').insert([{
        user_id: userId,
        date,
        exercise_id: String(exerciseId),
        sets
    }]).select();
    if (error) console.error(error);
    return data;
};

export const deleteLog = async (id) => {
    const { error } = await supabase.from('workout_logs').delete().eq('id', id);
    if (error) console.error(error);
};

export const updateLog = async (log) => {
    const { data, error } = await supabase
        .from('workout_logs')
        .update({ sets: log.sets, date: log.date })
        .eq('id', log.id)
        .select();
    if (error) console.error(error);
    return data;
};

export const getBodyWeights = async () => {
    const { data, error } = await supabase.from('body_weights').select('*');
    if (error) console.error(error);
    return data || [];
};

export const addBodyWeight = async (weight, date) => {
    const userId = await getUser();
    const { data, error } = await supabase.from('body_weights').insert([{
        user_id: userId,
        date,
        weight
    }]).select();
    if (error) console.error(error);
    return data;
};

export const deleteBodyWeight = async (id) => {
    const { error } = await supabase.from('body_weights').delete().eq('id', id);
    if (error) console.error(error);
};

export const getCardioLogs = async () => {
    const { data, error } = await supabase.from('cardio_logs').select('*');
    if (error) console.error(error);
    return data || [];
};

export const addCardioLog = async (date, type, duration, distance) => {
    const userId = await getUser();
    const { data, error } = await supabase.from('cardio_logs').insert([{
        user_id: userId,
        date,
        type,
        duration,
        distance
    }]).select();
    if (error) console.error(error);
    return await getCardioLogs();
};

export const deleteCardioLog = async (id) => {
    const { error } = await supabase.from('cardio_logs').delete().eq('id', id);
    if (error) console.error(error);
    return await getCardioLogs();
};

export const updateCardioLog = async (log) => {
    const { data, error } = await supabase
        .from('cardio_logs')
        .update({
            date: log.date,
            type: log.type,
            duration: log.duration,
            distance: log.distance
        })
        .eq('id', log.id)
        .select();
    if (error) console.error(error);
    return await getCardioLogs();
};

export const getCircumferences = async () => {
    const { data, error } = await supabase.from('circumferences').select('*');
    if (error) console.error(error);
    return data || [];
};

export const addCircumference = async (date, bodyPart, measurement) => {
    const userId = await getUser();
    const { data, error } = await supabase.from('circumferences').insert([{
        user_id: userId,
        date,
        body_part: bodyPart,
        measurement
    }]).select();
    if (error) console.error(error);
    return data;
};

export const deleteCircumference = async (id) => {
    const { error } = await supabase.from('circumferences').delete().eq('id', id);
    if (error) console.error(error);
};

export const getUserSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching settings:', error);
        return null;
    }

    return data;
};

export const updateUserSettings = async (settings) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, ...settings });

    if (error) console.error('Error updating settings:', error);
};

export const getLogsRange = async (startDate, endDate) => {
    let query = supabase.from('workout_logs').select('*');
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    query = query.order('date', { ascending: false });
    const { data, error } = await query;
    if (error) console.error(error);
    return data || [];
};

export const getCardioLogsRange = async (startDate, endDate) => {
    let query = supabase.from('cardio_logs').select('*');
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    query = query.order('date', { ascending: false });
    const { data, error } = await query;
    if (error) console.error(error);
    return data || [];
};

// ... (keep legacy functions for safety)
export const getLogsByDate = async (dateStr) => {
  const { data, error } = await supabase
    .from('workout_logs') 
    .select('*')
    .eq('date', dateStr);
  if (error) throw error;
  return data;
};

export const getCardioLogsByDate = async (dateStr) => {
  const { data, error } = await supabase
    .from('cardio_logs')
    .select('*')
    .eq('date', dateStr);
  if (error) throw error;
  return data;
};

export const getRecentLogs = async (limit = 50) => {
  const { data, error } = await supabase
    .from('workout_logs') 
    .select('*')
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
};

export const getRecentCardioLogs = async (limit = 50) => {
  const { data, error } = await supabase
    .from('cardio_logs')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
};

export const getDailyOverride = async (date) => {
    const userId = await getUser();
    const { data, error } = await supabase
        .from('daily_overrides')
        .select('routine_id')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
    
    if (error) {
        console.error('Error fetching override:', error);
        return null;
    }
    return data?.routine_id || null;
};

export const setDailyOverride = async (date, routineId) => {
    const userId = await getUser();
    const { error } = await supabase
        .from('daily_overrides')
        .upsert({ user_id: userId, date, routine_id: routineId });
    if (error) console.error('Error setting override:', error);
};

export const removeDailyOverride = async (date) => {
    const userId = await getUser();
    const { error } = await supabase
        .from('daily_overrides')
        .delete()
        .eq('user_id', userId)
        .eq('date', date);
    if (error) console.error('Error removing override:', error);
};