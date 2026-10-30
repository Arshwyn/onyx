import React, { useState, useEffect, useRef } from 'react';
import {
  getLogsRange, getCardioLogsRange, getExercises, deleteLog, updateLog, deleteCardioLog, updateCardioLog,
  addLog, addCardioLog
} from '../dataManager';
import ConfirmModal from './ConfirmModal';
import MicroLabel from './ui/MicroLabel';
import BottomSheet from './ui/BottomSheet';
import Pill from './ui/Pill';
import DatePill from './ui/DatePill';
import type { Exercise, WorkoutLog, CardioLog } from '../types';

type LiftHistoryItem = WorkoutLog & { dataType: 'lift' };
type CardioHistoryItem = CardioLog & { dataType: 'cardio' };
type HistoryItem = LiftHistoryItem | CardioHistoryItem;

interface ModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (() => void) | null;
  isDestructive: boolean;
}

interface LastDeleted {
  item: HistoryItem;
}

const CARDIO_TYPES = ['Run', 'Walk', 'Cycle', 'Treadmill', 'Stairmaster', 'Rowing', 'Elliptical', 'HIIT', 'Other'];

const UNDO_WINDOW_MS = 4500;

export default function HistoryView() {
  const [loading, setLoading] = useState(true);

  // Settings
  const [weightUnit, setWeightUnit] = useState('lbs');
  const [distUnit, setDistUnit] = useState('mi');

  // Helper: Get Today's Date in Local Time (YYYY-MM-DD)
  const getTodayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Data
  const [combinedHistory, setCombinedHistory] = useState<HistoryItem[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Record<string, string>>({});
  const [editingLog, setEditingLog] = useState<HistoryItem | null>(null);
  const [modalConfig, setModalConfig] = useState<ModalConfig>({ isOpen: false, title: '', message: '', onConfirm: null, isDestructive: false });

  // Soft-delete + undo (spec: 2-line undo bar, auto-dismisses after ~4.5s)
  const [lastDeleted, setLastDeleted] = useState<LastDeleted | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Filter State - Default to Today
  const [filterStart, setFilterStart] = useState(getTodayDate());
  const [filterEnd, setFilterEnd] = useState(getTodayDate());

  const showAlert = (title: string, message: string) => setModalConfig({ isOpen: true, title, message, onConfirm: null, isDestructive: false });
  const openConfirm = (title: string, message: string, onConfirm: (() => void) | null = null, isDestructive = false) => {
    setModalConfig({ isOpen: true, title, message, onConfirm, isDestructive });
  };

  useEffect(() => {
    const loadSettings = () => {
        setWeightUnit((localStorage.getItem('onyx_unit_weight') || 'lbs').toLowerCase());
        setDistUnit((localStorage.getItem('onyx_unit_distance') || 'mi').toLowerCase());
    };
    loadSettings();
    window.addEventListener('storage', loadSettings);
    return () => {
      window.removeEventListener('storage', loadSettings);
      clearTimeout(undoTimer.current);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        // Fetch logs only for the selected range (defaults to today)
        const [loadedLogs, loadedCardio, loadedExercises] = await Promise.all([
          getLogsRange(filterStart, filterEnd),
          getCardioLogsRange(filterStart, filterEnd),
          getExercises()
        ]);

        const map: Record<string, string> = {};
        loadedExercises.forEach((ex: Exercise) => map[ex.id] = ex.name);

        // Filter out logs that are marked as "skipped"
        const liftingItems: LiftHistoryItem[] = loadedLogs
            .filter(log => !(log.sets && log.sets.length > 0 && log.sets[0].isSkipped))
            .map(log => ({ ...log, dataType: 'lift' as const }));

        const cardioItems: CardioHistoryItem[] = loadedCardio.map(log => ({ ...log, dataType: 'cardio' as const }));

        const allItems: HistoryItem[] = [...liftingItems, ...cardioItems];
        allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setCombinedHistory(allItems);
        setExerciseMap(map);
    } catch (error) {
        console.error("Failed to load history:", error);
    } finally {
        setLoading(false);
    }
  };

  // Reload data whenever filters change. The ref hands the effect the newest
  // loadData (which reads the current filters) without listing it as a dependency.
  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  });
  useEffect(() => {
    loadDataRef.current();
  }, [filterStart, filterEnd]);

  const isSameItem = (a: HistoryItem, b: HistoryItem) => a.dataType === b.dataType && a.id === b.id;

  // Spec: immediate delete + a dismissable undo bar, no confirm step. deleteLog/deleteCardioLog
  // are performWrite-backed, so they never throw or signal failure to the caller here -- a
  // genuine server-side rejection is already toasted by performWrite, but the local removal
  // below is optimistic and has no way to know that happened. Once the undo window closes
  // (below), a loadData() reconciles the list against server truth, self-correcting if the
  // delete didn't actually go through -- deferred rather than immediate so it doesn't fight
  // the optimistic remove this undo bar depends on.
  const performDelete = async (item: HistoryItem) => {
    if (item.dataType === 'lift') { await deleteLog(item.id); } else { await deleteCardioLog(item.id); }

    setCombinedHistory(prev => prev.filter(h => !isSameItem(h, item)));

    clearTimeout(undoTimer.current);
    setLastDeleted({ item });
    undoTimer.current = setTimeout(() => { setLastDeleted(null); loadData(); }, UNDO_WINDOW_MS);
  };

  const handleDelete = (item: HistoryItem) => {
    const label = item.dataType === 'lift' ? (exerciseMap[item.exerciseId || item.exercise_id || ''] || 'this exercise') : item.type;
    openConfirm('Delete Entry?', `Are you sure you want to remove ${label} from your history?`, () => performDelete(item), true);
  };

  const undoDelete = async () => {
    if (!lastDeleted) return;
    clearTimeout(undoTimer.current);
    const { item } = lastDeleted;
    setLastDeleted(null);

    if (item.dataType === 'lift') {
      await addLog(item.date, item.exerciseId || item.exercise_id || '', item.sets);
    } else {
      await addCardioLog(item.date, item.type, item.duration, item.distance ?? null);
    }
    loadData();
  };

  const startEditing = (log: HistoryItem) => { setEditingLog(JSON.parse(JSON.stringify(log))); };

  const saveEdit = async () => {
    if (!editingLog) return;
    if (editingLog.dataType === 'lift') {
        const validSets = editingLog.sets.filter(s => s.weight && s.reps);
        if (validSets.length === 0) { showAlert('Missing Data', 'Must have at least one complete set.'); return; }
        const finalLog = { ...editingLog, sets: validSets };
        await updateLog(finalLog);
    } else {
        if (!editingLog.duration) { showAlert('Missing Data', 'Duration is required.'); return; }
        await updateCardioLog(editingLog);
    }
    setEditingLog(null); loadData();
  };

  const updateEditSet = (index: number, field: 'weight' | 'reps', value: string) => {
    if (!editingLog || editingLog.dataType !== 'lift') return;
    const newSets = [...editingLog.sets];
    newSets[index] = { ...newSets[index], [field]: value };
    setEditingLog({ ...editingLog, sets: newSets });
  };
  // Copies the last set's values instead of adding a blank line, same as
  // WorkoutLogger/DailyView's handleAddSet.
  const addEditSet = () => {
    if (!editingLog || editingLog.dataType !== 'lift') return;
    const lastSet = editingLog.sets[editingLog.sets.length - 1] || { weight: '', reps: '' };
    setEditingLog({ ...editingLog, sets: [...editingLog.sets, { weight: lastSet.weight, reps: lastSet.reps }] });
  };
  const removeEditSet = (index: number) => {
    if (!editingLog || editingLog.dataType !== 'lift') return;
    const newSets = editingLog.sets.filter((_, i) => i !== index);
    setEditingLog({ ...editingLog, sets: newSets });
  };

  const downloadCSV = () => {
    let csv = 'Type,Date,Activity,Duration/Weight,Distance/Reps\n';
    combinedHistory.forEach(item => {
      if (item.dataType === 'lift') {
        const exName = exerciseMap[item.exerciseId || item.exercise_id || ''] || 'Unknown';
        const sets = item.sets || [];
        sets.forEach(set => { csv += `LIFT,${item.date},"${exName}",${set.weight},${set.reps}\n`; });
      } else {
        csv += `CARDIO,${item.date},"${item.type}",${item.duration},${item.distance || ''}\n`;
      }
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `onyx_history_${filterStart || 'start'}_to_${filterEnd || 'end'}.csv`; a.click();
  };

  // Helper to clear filters (Show All History)
  const clearFilters = () => {
    setFilterStart('');
    setFilterEnd('');
  };

  return (
    <div className="w-full max-w-md mx-auto pb-20 overflow-x-hidden">
      <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={modalConfig.onConfirm} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} isDestructive={modalConfig.isDestructive} />

      <div className="flex justify-between items-center mt-1.5 mb-3.5">
        <h1 className="font-display font-bold italic text-2xl uppercase text-white m-0">History</h1>
        <button onClick={downloadCSV} className="bg-[#141416] border border-border-input text-text-secondary text-[11px] font-bold px-3 py-1.5 rounded-lg hover:text-white transition">Export CSV</button>
      </div>

      <div className="mb-3.5">
        {/* Pills are sized to their content (no forced w-full) rather than
            stretched across a grid column, so the Clear button can sit on
            the same row as the pills instead of wrapping to its own line
            below -- min-w on DatePill itself still guards against the date
            text or wording ever clipping. */}
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <MicroLabel muted className="block mb-1.5">From</MicroLabel>
            <DatePill value={filterStart} onChange={setFilterStart} />
          </div>
          <div>
            <MicroLabel muted className="block mb-1.5">To</MicroLabel>
            <DatePill value={filterEnd} onChange={setFilterEnd} />
          </div>
          {(filterStart || filterEnd) && (
            <button onClick={clearFilters} className="flex-shrink-0 bg-[#1a1a1e] border border-border-pill text-text-tertiary text-[11px] font-bold px-2.5 py-1 rounded-pill hover:text-white transition">Clear</button>
          )}
        </div>
      </div>

      {lastDeleted && (
        <div className="flex justify-between items-center bg-[#1a1a1e] border border-border-pill rounded-lg px-3.5 py-2.5 mb-3">
          <span className="text-xs text-text-tertiary">Entry deleted</span>
          <button onClick={undoDelete} className="bg-none border-none text-accent-light text-xs font-bold cursor-pointer">Undo</button>
        </div>
      )}

      {loading ? (
          <div className="text-center pt-20 text-text-muted animate-pulse">Loading Logs...</div>
      ) : (
          <div>
            {combinedHistory.length === 0 && <p className="text-center text-text-faint text-xs mt-8">No logs in this period.</p>}

            {combinedHistory.map((item) => {
              if (item.dataType === 'cardio') {
                return (
                  <div key={`c-${item.id}`} className="rounded-card border border-accent/30 bg-accent/5 p-3 mb-2.5">
                    <div className="flex justify-between items-center">
                      <div className="min-w-0">
                        <span className="font-bold text-[13px] text-accent-light">{item.type}</span>
                        <div className="font-mono text-[10.5px] text-text-muted mt-0.5">{item.date}</div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0 items-center">
                        <div className="text-right mr-1">
                          <div className="font-mono text-[13px] text-white font-bold">{item.duration} min</div>
                          {item.distance && <div className="font-mono text-[10px] text-text-muted">{item.distance} {distUnit}</div>}
                        </div>
                        <button onClick={() => startEditing(item)} className="bg-[#141416] border border-border-input text-text-tertiary text-[10.5px] font-bold px-2.5 py-1.5 rounded-lg hover:text-white transition">Edit</button>
                        <button onClick={() => handleDelete(item)} className="bg-danger-bg border border-danger-border text-danger text-[10.5px] font-bold px-2.5 py-1.5 rounded-lg hover:text-white transition">Del</button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={`l-${item.id}`} className="rounded-card border border-border bg-surface p-3 mb-2.5">
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="min-w-0">
                      <span className="font-bold text-[13px] text-text-secondary">{exerciseMap[item.exerciseId || item.exercise_id || ''] || 'Unknown Exercise'}</span>
                      <div className="font-mono text-[10.5px] text-text-muted mt-0.5">{item.date}</div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => startEditing(item)} className="bg-[#141416] border border-border-input text-text-tertiary text-[10.5px] font-bold px-2.5 py-1.5 rounded-lg hover:text-white transition">Edit</button>
                      <button onClick={() => handleDelete(item)} className="bg-danger-bg border border-danger-border text-danger text-[10.5px] font-bold px-2.5 py-1.5 rounded-lg hover:text-white transition">Del</button>
                    </div>
                  </div>
                  {(item.sets || []).map((set, idx) => (
                    <div key={idx} className="flex justify-between font-mono text-[11px] text-text-tertiary py-0.5 border-t border-white/5 first:border-0">
                      <span className="text-text-faint">Set {idx + 1}</span>
                      <span>{set.weight} {weightUnit} &times; {set.reps}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
      )}

      <BottomSheet isOpen={!!editingLog} onClose={() => setEditingLog(null)} title="Edit Entry" scrollable>
        {editingLog && (
          <>
            <MicroLabel className="block mb-1.5">Date</MicroLabel>
            <div className="mb-3.5">
              <DatePill accent={false} value={editingLog.date} onChange={(v) => setEditingLog({ ...editingLog, date: v })} className="py-2 text-[13px]" />
            </div>

            {editingLog.dataType === 'lift' ? (
              <>
                <div className="font-bold text-sm text-white mb-2.5">{exerciseMap[editingLog.exerciseId || editingLog.exercise_id || ''] || 'Unknown Exercise'}</div>
                <div className="space-y-1.5 mb-3">
                  {editingLog.sets.map((set, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-text-faint w-9 flex-shrink-0">Set {index + 1}</span>
                      <input type="number" value={set.weight} onChange={(e) => updateEditSet(index, 'weight', e.target.value)} placeholder={weightUnit} className="flex-1 min-w-0 bg-black border border-border-pill rounded-md px-2 py-1.5 text-white text-center font-mono text-xs outline-none focus:border-accent transition" />
                      <span className="text-border-subtle text-[11px]">&times;</span>
                      <input type="number" value={set.reps} onChange={(e) => updateEditSet(index, 'reps', e.target.value)} placeholder="reps" className="flex-1 min-w-0 bg-black border border-border-pill rounded-md px-2 py-1.5 text-white text-center font-mono text-xs outline-none focus:border-accent transition" />
                      <button onClick={() => removeEditSet(index)} className="w-5 text-text-faint hover:text-danger text-sm leading-none flex-shrink-0">&#10005;</button>
                    </div>
                  ))}
                </div>
                <button onClick={addEditSet} className="bg-none border-none text-accent-light text-[11px] font-bold cursor-pointer p-0 mb-4">+ Add Set</button>
              </>
            ) : (
              <>
                <MicroLabel className="block mb-1.5">Type</MicroLabel>
                <div className="flex flex-wrap gap-1.5 mb-3.5">
                  {CARDIO_TYPES.map(t => (
                    <Pill key={t} active={editingLog.type === t} onClick={() => setEditingLog({ ...editingLog, type: t })}>{t}</Pill>
                  ))}
                </div>
                <div className="flex gap-2 mb-4">
                  <div className="flex-1 min-w-0">
                    <MicroLabel className="block mb-1.5">Duration (min)</MicroLabel>
                    <input type="number" value={editingLog.duration} onChange={(e) => setEditingLog({ ...editingLog, duration: e.target.value })} className="w-full box-border bg-black border border-border-pill rounded-lg px-2.5 py-2 text-white font-mono text-[13px] outline-none focus:border-accent transition" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <MicroLabel className="block mb-1.5">Distance</MicroLabel>
                    <input type="number" value={editingLog.distance || ''} onChange={(e) => setEditingLog({ ...editingLog, distance: e.target.value })} placeholder={distUnit} className="w-full box-border bg-black border border-border-pill rounded-lg px-2.5 py-2 text-white font-mono text-[13px] outline-none focus:border-accent transition" />
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2.5">
              <button onClick={() => setEditingLog(null)} className="flex-1 bg-[#1a1a1e] border border-border-pill text-text-secondary font-bold text-xs py-2.5 rounded-lg hover:text-white transition">Cancel</button>
              <button onClick={saveEdit} className="flex-1 bg-accent border-none text-white font-extrabold text-xs uppercase py-2.5 rounded-lg hover:bg-accent-light transition">Save</button>
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
