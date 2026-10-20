import React, { useState, useEffect } from 'react';
import {
  getBodyWeights, deleteBodyWeight,
  getLogs, getExercises,
  getCircumferences, deleteCircumference
} from '../dataManager';
import { emitError } from '../lib/toastBus';
import ConfirmModal from './ConfirmModal';
import Card from './ui/Card';
import MicroLabel from './ui/MicroLabel';
import Pill from './ui/Pill';
import SegmentedToggle from './ui/SegmentedToggle';
import EmptyChartState from './ui/EmptyChartState';
import DatePill from './ui/DatePill';
import type { Exercise, BodyWeight, Circumference } from '../types';

interface TrendPoint {
  id: string | number;
  date: string;
  weight: string | number;
}

interface ModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (() => void) | null;
  isDestructive: boolean;
}

type TrendsMode = 'exercises' | 'bodyweight' | 'measurements';

const DEFAULT_RANGE_DAYS = 30;

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateMonthsAgo = (months: number) => {
  const now = new Date();
  const targetMonthIndex = now.getMonth() - months;
  // Date.setMonth() overflows a day that doesn't exist in the target month
  // (e.g. Aug 31 minus 6 months) into the following month instead of
  // clamping to it (landing on Mar 2/3 rather than Feb 28/29). Clamp to the
  // target month's actual last day instead -- day 0 of "next month" is a
  // shorthand for "last day of this month" that Date's constructor already
  // normalizes correctly, including negative month indices rolling back the
  // year.
  const daysInTargetMonth = new Date(now.getFullYear(), targetMonthIndex + 1, 0).getDate();
  const d = new Date(now.getFullYear(), targetMonthIndex, Math.min(now.getDate(), daysInTargetMonth));
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Lowest to highest, per spec -- shared by the Lifts/Weight/Measure tabs'
// date range (see renderDateRange below).
const RANGE_PRESETS: { label: string; getStart: () => string }[] = [
  { label: 'Last 7 Days', getStart: () => getDateDaysAgo(7) },
  { label: 'Last 15 Days', getStart: () => getDateDaysAgo(15) },
  { label: 'Last 30 Days', getStart: () => getDateDaysAgo(DEFAULT_RANGE_DAYS) },
  { label: 'Last 6 Months', getStart: () => getDateMonthsAgo(6) },
  { label: 'Last 12 Months', getStart: () => getDateMonthsAgo(12) },
];

export default function TrendsView() {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<TrendsMode>('exercises');

  // --- MODAL STATE ---
  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false, title: '', message: '', onConfirm: () => { }, isDestructive: false
  });

  // --- SETTINGS STATE ---
  const [weightUnit, setWeightUnit] = useState('lbs');
  const [measureUnit, setMeasureUnit] = useState('in');

  // --- DATE RANGE (defaults to the past 30 days, widenable/narrowable) ---
  const [rangeStart, setRangeStart] = useState(getDateDaysAgo(DEFAULT_RANGE_DAYS));
  const [rangeEnd, setRangeEnd] = useState(getLocalDate());

  // --- STATE: EXERCISES ---
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExId, setSelectedExId] = useState<string | number>('');
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [exerciseData, setExerciseData] = useState<TrendPoint[]>([]);

  // --- STATE: BODY WEIGHT ---
  const [bodyData, setBodyData] = useState<BodyWeight[]>([]);

  // --- STATE: MEASUREMENTS ---
  const [measurementData, setMeasurementData] = useState<Circumference[]>([]);
  const [filteredMeasurements, setFilteredMeasurements] = useState<(Circumference & { weight: string | number })[]>([]);
  const [bodyPart, setBodyPart] = useState('Navel');

  const BODY_PARTS = ['Navel', 'Waist', 'Chest', 'Left Arm', 'Right Arm', 'Left Thigh', 'Right Thigh', 'Calves', 'Neck', 'Shoulders', 'Hips'];

  useEffect(() => {
    loadAllData();

    const loadSettings = () => {
      setWeightUnit((localStorage.getItem('onyx_unit_weight') || 'lbs').toLowerCase());
      setMeasureUnit((localStorage.getItem('onyx_unit_measure') || 'in').toLowerCase());
    };
    loadSettings();
    window.addEventListener('storage', loadSettings);

    // Reconciles any optimistic local entries added while offline (see
    // handleDeleteWeight/handleDeleteMeasurement below) with real server data
    // once a queued write actually syncs — dispatched by flushWriteQueue.
    window.addEventListener('onyx-sync-complete', loadAllData);

    return () => {
      window.removeEventListener('storage', loadSettings);
      window.removeEventListener('onyx-sync-complete', loadAllData);
    };
  }, []);

  useEffect(() => {
    if (mode === 'exercises' && selectedExId) {
      calculateExerciseTrend(selectedExId);
    }
    if (mode === 'measurements') {
      filterMeasurements(bodyPart);
    }
  }, [mode, selectedExId, bodyPart, measurementData]);

  const openConfirm = (title: string, message: string, onConfirm: (() => void) | null = null, isDestructive = false) => {
    setModalConfig({ isOpen: true, title, message, onConfirm, isDestructive });
  };

  const inRange = (dateStr: string) => (!rangeStart || dateStr >= rangeStart) && (!rangeEnd || dateStr <= rangeEnd);

  const loadAllData = async () => {
    setLoading(true);
    // getBodyWeights()/getCircumferences() throw on failure (see
    // dataManager.ts) — unlike before #23, so this now needs a catch.
    try {
      const [bData, allEx, logs, mData] = await Promise.all([
        getBodyWeights(),
        getExercises(),
        getLogs(),
        getCircumferences()
      ]);

      bData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setBodyData(bData);

      setExercises(allEx);
      // No default lift selection -- Trends starts empty until the user
      // actually searches for and picks one (see the exercises tab below).

      setMeasurementData(mData);
    } catch (e) {
      console.error("Failed to load trends data", e);
      emitError('Could not load trends data.');
    } finally {
      setLoading(false);
    }
  };

  const calculateExerciseTrend = async (exId: string | number) => {
    const allLogs = await getLogs();
    const relevantLogs = allLogs.filter(l =>
        String(l.exercise_id || l.exerciseId) === String(exId) &&
        !(l.sets && l.sets.length > 0 && l.sets[0].isSkipped)
    );

    const points: TrendPoint[] = relevantLogs.map(log => {
      const sets = log.sets || [];
      const maxWeight = sets.reduce((max, set) => Math.max(max, parseFloat(String(set.weight)) || 0), 0);
      return { id: log.id, date: log.date, weight: maxWeight };
    });

    points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setExerciseData(points);
  };

  const filterMeasurements = (part: string) => {
    const filtered: (Circumference & { weight: string | number })[] = measurementData
      .filter(m => m.body_part === part)
      .map(m => ({ ...m, weight: m.measurement }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setFilteredMeasurements(filtered);
  };

  // getBodyWeights()/getCircumferences() throw on failure (see #23 and
  // dataManager.ts) rather than swallowing, so a failed refetch — offline
  // or a genuine transient failure while online — lands in the catch
  // instead of silently resolving to [] and wiping bodyData/
  // measurementData. Within the catch, navigator.onLine (same signal the
  // rest of the app already trusts for this — App.tsx's banner, toastBus's
  // emitError gate, DailyView's equivalent handlers) decides which failure
  // this was: offline falls back to an optimistic local update (reconciled
  // later via 'onyx-sync-complete', see the effect above, once a queued
  // write actually syncs); a genuine online failure surfaces the normal
  // error toast and leaves existing data alone rather than fabricating an
  // entry for a write whose outcome we don't actually know.
  const handleDeleteMeasurement = (id: string | number) => {
    openConfirm(
      "Delete Measurement?",
      "Are you sure you want to delete this measurement?",
      async () => {
        await deleteCircumference(id);
        try {
          const mData = await getCircumferences();
          setMeasurementData(mData);
        } catch (e) {
          console.error("Failed to refresh measurements", e);
          if (navigator.onLine) {
            emitError('Deleted, but could not refresh measurements.');
          } else {
            setMeasurementData(prev => prev.filter(m => m.id !== id));
          }
        }
      },
      true
    );
  };

  const handleDeleteWeight = (id: string | number) => {
    openConfirm(
      "Delete Weight Entry?",
      "Are you sure you want to delete this weight log?",
      async () => {
        await deleteBodyWeight(id);
        try {
          const bData = await getBodyWeights();
          bData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          setBodyData(bData);
        } catch (e) {
          console.error("Failed to refresh body weight", e);
          if (navigator.onLine) {
            emitError('Deleted, but could not refresh body weight history.');
          } else {
            setBodyData(prev => prev.filter(b => b.id !== id));
          }
        }
      },
      true
    );
  };

  const selectedExercise = exercises.find(e => String(e.id) === String(selectedExId));
  const trimmedQuery = exerciseQuery.trim().toLowerCase();
  const exerciseOptions = trimmedQuery
    ? exercises.filter(e => e.name.toLowerCase().includes(trimmedQuery)).slice(0, 6)
    : [];

  const handleSelectExercise = (ex: Exercise) => {
    setSelectedExId(ex.id);
    setExerciseQuery('');
  };

  const handleClearExercise = () => {
    setSelectedExId('');
    setExerciseQuery('');
    setRangeStart(getDateDaysAgo(DEFAULT_RANGE_DAYS));
    setRangeEnd(getLocalDate());
  };

  const rangedExerciseData = exerciseData.filter(p => inRange(p.date));
  const rangedBodyData = bodyData.filter(p => inRange(p.date));
  const rangedMeasurements = filteredMeasurements.filter(p => inRange(p.date));

  // Mirrors the prototype's computeChart() (see design_handoff_onyx_app):
  // a 100x50 viewBox, min/mid/max y-axis labels, and a gradient-filled area
  // under a straight-segment line through each point.
  const renderChart = (dataPoints: TrendPoint[], gradientId: string) => {
    if (dataPoints.length < 2) return <EmptyChartState />;

    const width = 100;
    const height = 50;
    const values = dataPoints.map(p => parseFloat(String(p.weight)));

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    const rawRange = maxVal - minVal;
    const padding = rawRange === 0 ? (maxVal * 0.1 || 10) : rawRange * 0.15;

    const domainMin = minVal - padding;
    const domainMax = maxVal + padding;
    const range = domainMax - domainMin;

    const getY = (val: number) => height - ((val - domainMin) / range) * height;
    const getX = (index: number) => (index / (dataPoints.length - 1)) * width;

    const coords = dataPoints.map((point, index) => [getX(index), getY(parseFloat(String(point.weight)))]);
    const linePath = 'M' + coords.map(c => `${c[0]},${c[1]}`).join(' L');
    const areaPath = `${linePath} L${coords[coords.length - 1][0]},${height} L${coords[0][0]},${height} Z`;

    const trendUp = parseFloat(String(dataPoints[dataPoints.length - 1].weight)) > parseFloat(String(dataPoints[0].weight));
    const trendLabel = minVal === maxVal ? 'Stable' : (trendUp ? '▲ Up' : '▼ Down');

    return (
      <Card className="mb-4">
        <div className="flex justify-between items-baseline mb-3">
          <MicroLabel>Progress ({dataPoints.length} entries)</MicroLabel>
          <span className="text-[10px] text-success font-mono">{trendLabel}</span>
        </div>

        <div className="flex gap-2.5">
          <div className="flex flex-col justify-between text-[9px] text-text-muted font-mono text-right min-w-[34px] h-[130px] select-none">
            <span>{maxVal.toFixed(1)}</span>
            <span>{((maxVal + minVal) / 2).toFixed(1)}</span>
            <span>{minVal.toFixed(1)}</span>
          </div>

          <div className="flex-1 relative h-[130px]">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              <div className="border-t border-white/[0.06]"></div>
              <div className="border-t border-white/[0.06]"></div>
              <div className="border-t border-white/[0.06]"></div>
            </div>

            <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35"></stop>
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"></stop>
                </linearGradient>
              </defs>
              <path d={areaPath} fill={`url(#${gradientId})`} stroke="none"></path>
              <path d={linePath} fill="none" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
              {coords.map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="1.8" fill="#111114" stroke="#60a5fa" strokeWidth="1.4" vectorEffect="non-scaling-stroke">
                  <title>{dataPoints[i].date}: {dataPoints[i].weight}</title>
                </circle>
              ))}
            </svg>
          </div>
        </div>

        <div className="flex justify-between text-[9px] text-text-faint font-mono mt-2 pl-[42px]">
          <span>{dataPoints[0].date}</span>
          <span>{dataPoints[dataPoints.length - 1].date}</span>
        </div>
      </Card>
    );
  };

  const renderDateRange = () => (
    <div className="mb-3.5">
      {/* Labels and pills are separate grid rows (not each pill's own
          label+input) so From/To line up as columns rather than each pill
          carrying its own label inline -- that's what let one wrap under
          the other independently before. */}
      <div className="grid grid-cols-2 gap-3 mb-1.5">
        <MicroLabel muted>From</MicroLabel>
        <MicroLabel muted>To</MicroLabel>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-2">
        <DatePill value={rangeStart} onChange={setRangeStart} className="w-full" />
        <DatePill value={rangeEnd} onChange={setRangeEnd} className="w-full" />
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {RANGE_PRESETS.map(preset => {
          const presetStart = preset.getStart();
          const isActive = rangeStart === presetStart && rangeEnd === getLocalDate();
          return (
            <Pill
              key={preset.label}
              active={isActive}
              onClick={() => { setRangeStart(presetStart); setRangeEnd(getLocalDate()); }}
              className="flex-shrink-0 whitespace-nowrap"
            >
              {preset.label}
            </Pill>
          );
        })}
      </div>
    </div>
  );

  if (loading) return <div className="text-center pt-20 text-text-muted animate-pulse">Loading Trends...</div>;

  return (
    <div className="w-full max-w-md mx-auto text-white pb-20 overflow-x-hidden">

      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        isDestructive={modalConfig.isDestructive}
      />

      <h1 className="font-display font-bold italic text-2xl uppercase text-white mt-1.5 mb-3.5">Trends</h1>

      <SegmentedToggle
        options={[
          { value: 'exercises', label: 'Lifts' },
          { value: 'bodyweight', label: 'Weight' },
          { value: 'measurements', label: 'Measure' },
        ]}
        value={mode}
        onChange={setMode}
        className="mb-4"
      />

      {mode === 'exercises' && (
        <div>
          <MicroLabel className="block mb-2">Exercise</MicroLabel>
          <input
            type="text"
            value={exerciseQuery}
            onChange={(e) => setExerciseQuery(e.target.value)}
            placeholder="Search exercise…"
            className="w-full bg-surface border border-border-input rounded-lg px-3 py-2.5 text-white text-[13px] outline-none focus:border-accent transition mb-1.5"
          />
          {exerciseOptions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {exerciseOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => handleSelectExercise(opt)}
                  className="bg-[#141416] border border-border-input text-text-secondary text-xs font-semibold px-3 py-1.5 rounded-pill whitespace-nowrap hover:text-white transition"
                >
                  {opt.name}
                </button>
              ))}
            </div>
          )}

          {!selectedExercise ? (
            <p className="text-center text-text-faint text-xs mt-10">Search for a lift above to see its trend.</p>
          ) : (
            <>
              <div className="flex justify-between items-center gap-2 mb-4">
                <div className="font-mono text-[11px] text-accent-light font-bold truncate">
                  Showing: {selectedExercise.name}
                </div>
                <button onClick={handleClearExercise} className="flex-shrink-0 bg-[#1a1a1e] border border-border-pill text-text-tertiary text-[11px] font-bold px-2.5 py-1 rounded-pill hover:text-white transition">Clear</button>
              </div>

              {renderDateRange()}

              {renderChart(rangedExerciseData, 'gradEx')}

              <MicroLabel className="block mb-2">Log History</MicroLabel>
              <div className="space-y-2">
                {[...rangedExerciseData].reverse().map((entry, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-surface border border-border rounded-lg px-3.5 py-2.5">
                    <span className="font-mono text-[11px] text-text-muted">{entry.date}</span>
                    <span className="font-bold text-[13px] text-white">{entry.weight} <span className="text-[10px] text-text-faint font-normal">{weightUnit.toLowerCase()}</span></span>
                  </div>
                ))}
                {rangedExerciseData.length === 0 && <p className="text-text-faint text-xs italic mt-2">No logs for {selectedExercise.name} in this period.</p>}
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'bodyweight' && (
        <div>
          {renderDateRange()}

          {renderChart(rangedBodyData, 'gradWt')}

          <MicroLabel className="block mb-2">History</MicroLabel>
          <div className="space-y-2">
            {[...rangedBodyData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(entry => (
              <div key={entry.id} className="flex justify-between items-center bg-surface border border-border rounded-lg px-3.5 py-2.5">
                <span className="font-mono text-[11px] text-text-muted">{entry.date}</span>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-[13px] text-white">{entry.weight} <span className="text-[10px] text-text-faint font-normal">{weightUnit.toLowerCase()}</span></span>
                  <button onClick={() => handleDeleteWeight(entry.id)} className="bg-none border-none text-text-faint hover:text-danger text-sm cursor-pointer">✕</button>
                </div>
              </div>
            ))}
            {rangedBodyData.length === 0 && <p className="text-text-faint text-xs italic mt-2">No weight logs in this period.</p>}
          </div>
        </div>
      )}

      {mode === 'measurements' && (
        <div>
          <MicroLabel className="block mb-2">Body Part</MicroLabel>
          <div className="flex gap-1.5 mb-3.5 overflow-x-auto no-scrollbar pb-0.5">
            {BODY_PARTS.map(part => (
              <Pill key={part} active={bodyPart === part} onClick={() => setBodyPart(part)} className="flex-shrink-0 whitespace-nowrap">
                {part}
              </Pill>
            ))}
          </div>

          {renderDateRange()}

          {renderChart(rangedMeasurements, 'gradMs')}

          <MicroLabel className="block mb-2">{bodyPart} History</MicroLabel>
          <div className="space-y-2">
            {[...rangedMeasurements].reverse().map(entry => (
              <div key={entry.id} className="flex justify-between items-center bg-surface border border-border rounded-lg px-3.5 py-2.5">
                <span className="font-mono text-[11px] text-text-muted">{entry.date}</span>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-[13px] text-white">{entry.measurement} <span className="text-[10px] text-text-faint font-normal">{measureUnit.toLowerCase()}</span></span>
                  <button onClick={() => handleDeleteMeasurement(entry.id)} className="bg-none border-none text-text-faint hover:text-danger text-sm cursor-pointer">✕</button>
                </div>
              </div>
            ))}
            {rangedMeasurements.length === 0 && <p className="text-text-faint text-xs italic mt-2">No records for {bodyPart} in this period.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
