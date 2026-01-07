// src/dataManager.js

const EXERCISE_KEY = 'onyx_exercises';
const LOGS_KEY = 'onyx_logs';

const DEFAULT_EXERCISES = [
    { id: 1, name: "Squat", category: "Legs" },
    { id: 2, name: "Bench Press", category: "Chest" },
    { id: 3, name: "Deadlift", category: "Back" },
    { id: 4, name: "Overhead Press", category: "Shoulders" },
    { id: 5, name: "Pull Up", category: "Back" },
];

// --- EXERCISES ---

export const getExercises = () => {
    const stored = localStorage.getItem(EXERCISE_KEY);
    if (!stored) {
        localStorage.setItem(EXERCISE_KEY, JSON.stringify(DEFAULT_EXERCISES));
        return DEFAULT_EXERCISES;
    }
    return JSON.parse(stored);
};

export const addExercise = (name, category) => {
    const exercises = getExercises();
    const newExercise = {
        id: Date.now(),
        name,
        category
    };
    const updatedList = [...exercises, newExercise];
    localStorage.setItem(EXERCISE_KEY, JSON.stringify(updatedList));
    return updatedList;
};

export const getLogs = () => {
    const stored = localStorage.getItem(LOGS_KEY);
    return stored ? JSON.parse(stored) : [];
};

export const addLog = (date, exerciseId, sets) => {
    const logs = getLogs();
    const newLog = {
        id: Date.now(),
        date,        // Format: "YYYY-MM-DD"
        exerciseId,  // The ID of the exercise performed
        sets         // Array like: [{weight: 100, reps: 10}]
    };

    const updatedLogs = [...logs, newLog];
    localStorage.setItem(LOGS_KEY, JSON.stringify(updatedLogs));
    return updatedLogs;
};

export const deleteLog = (logId) => {
    const logs = getLogs();
    const updatedLogs = logs.filter(log => log.id !== logId);
    localStorage.setItem(LOGS_KEY, JSON.stringify(updatedLogs));
    return updatedLogs;
};

export const updateLog = (updatedLog) => {
    const logs = getLogs();
    const index = logs.findIndex(log => log.id === updatedLog.id);

    if (index !== -1) {
        logs[index] = updatedLog;
        localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    }
    return logs;
};

const ROUTINES_KEY = 'onyx_routines';

export const getRoutines = () => {
    const stored = localStorage.getItem(ROUTINES_KEY);
    return stored ? JSON.parse(stored) : [];
};

export const saveRoutine = (routine) => {
    const routines = getRoutines();
    // Remove existing routine for this specific day (if replacing) or id
    const filtered = routines.filter(r => r.id !== routine.id && r.day !== routine.day);

    const newRoutine = { ...routine, id: routine.id || Date.now() };
    const updated = [...filtered, newRoutine];

    localStorage.setItem(ROUTINES_KEY, JSON.stringify(updated));
    return updated;
};

export const deleteRoutine = (id) => {
    const routines = getRoutines();
    const updated = routines.filter(r => r.id !== id);
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(updated));
    return updated;
};