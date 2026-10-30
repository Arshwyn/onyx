import React, { useState } from 'react';
import BottomSheet from './ui/BottomSheet';
import Pill from './ui/Pill';
import MicroLabel from './ui/MicroLabel';
import { BAR_OPTIONS_LBS, BAR_OPTIONS_KG } from '../lib/plateOptions';

interface PlateBreakdown {
  plate: number;
  count: number;
}

interface PlateCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  initialWeight?: string | number;
  // Not tightened to 'lbs' | 'kg': both callers (DailyView, WorkoutLogger) derive
  // this from `localStorage.getItem(...).toLowerCase()`, an unvalidated string --
  // tightening here without validating there would just move the type error to
  // those out-of-scope files. Revisit when PR 1/PR 2 touch them directly.
  unit?: string;
}

const PLATE_SET_LBS = [45, 35, 25, 10, 5, 2.5];
const PLATE_SET_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export default function PlateCalculator({ isOpen, onClose, initialWeight, unit = 'lbs' }: PlateCalculatorProps) {
  const barOptions = unit === 'lbs' ? BAR_OPTIONS_LBS : BAR_OPTIONS_KG;
  const plateSet = unit === 'lbs' ? PLATE_SET_LBS : PLATE_SET_KG;

  const [barWeight, setBarWeight] = useState<number>(barOptions[0]);

  // The sheet always reflects whatever weight it was opened with -- there's no
  // manual weight entry in the spec, only the bar-weight chips below. Seeded from
  // Settings' "Default Bar Weight" when it's a valid option for the current unit,
  // otherwise falls back to the first chip like before that setting existed.
  // Re-seeded while rendering (not in an effect) whenever the sheet opens or the unit changes.
  const [seededFor, setSeededFor] = useState({ isOpen: false, unit });
  if (seededFor.isOpen !== isOpen || seededFor.unit !== unit) {
    setSeededFor({ isOpen, unit });
    if (isOpen) {
      const saved = parseFloat(localStorage.getItem('onyx_default_bar_weight') || '');
      setBarWeight(barOptions.includes(saved) ? saved : barOptions[0]);
    }
  }

  const targetWeight = parseFloat(String(initialWeight)) || 0;
  const belowBar = targetWeight < barWeight;

  const computePlates = (weight: number, bar: number): PlateBreakdown[] => {
    let remaining = Math.max(0, (weight - bar) / 2);
    const out: PlateBreakdown[] = [];
    plateSet.forEach((plate) => {
      const count = Math.floor(remaining / plate + 1e-6);
      if (count > 0) {
        out.push({ plate, count });
        remaining -= count * plate;
      }
    });
    return out.length ? out : [{ plate: 0, count: 0 }];
  };

  const plates = computePlates(targetWeight, barWeight);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Plate Calculator">
      <div className="font-mono text-[26px] text-accent font-bold mb-1">{targetWeight} {unit}</div>
      <div className="text-[11px] text-text-muted mb-2.5">{barWeight} {unit} bar + plates per side</div>

      <div className="flex items-center gap-2 mb-3.5">
        <MicroLabel muted>Bar</MicroLabel>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {barOptions.map((w) => (
            <Pill key={w} mono active={barWeight === w} onClick={() => setBarWeight(w)} className="shrink-0 whitespace-nowrap">
              {w === 0 ? 'None' : `${w} ${unit}`}
            </Pill>
          ))}
        </div>
      </div>

      {belowBar ? (
        <div className="py-2.5 text-sm text-text-muted italic">Target is below the bar weight.</div>
      ) : (
        plates.map((p, i) => (
          <div key={i} className="flex justify-between items-center py-2.5 border-b border-border">
            <span className="font-mono text-sm text-text-secondary font-bold">{p.plate} {unit}</span>
            <span className="font-mono text-[13px] text-text-muted">&times; {p.count} per side</span>
          </div>
        ))
      )}
    </BottomSheet>
  );
}
