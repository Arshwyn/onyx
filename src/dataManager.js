import { supabase } from './supabaseClient';

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
  // Fetch custom exercises from DB
  const { data, error } = await supabase.from('custom_exercises').select('*');
  if (error) console.error(error);
  
  const custom = data || [];
  // Merge defaults with custom ones
  // We map DB IDs to strings to ensure compatibility
  const formattedCustom = custom.map(e => ({...e, id: String(e.id)}));
  
  return [...DEFAULT_EXERCISES, ...formattedCustom];
};

export const addExercise = async (name, category) => {
  const userId = await getUser();
  const { data, error } = await supabase.from('custom_exercises').insert([{
    user_id: userId,
    name, 
    category
  }]).select();
  
  if (error) console.error(error);
  return data;
};

export const deleteCustomExercise = async (id) => {
  // Only allow deleting if it's NOT a default exercise (defaults start with 'ex_')
  if (String(id).startsWith('ex_')) return;

  const { error } = await supabase.from('custom_exercises').delete().eq('id', id);
  if (error) console.error(error);
};

// --- 2. ROUTINES ---
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

// --- 3. LOGS (LIFTING) ---
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

// --- 4. BODY WEIGHT ---
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

// --- 5. CARDIO ---
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