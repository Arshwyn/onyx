import React, { useState, useEffect } from 'react';
import { getLogs, getExercises } from '../dataManager';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function TrendsView() {
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    // Load exercises on startup
    const exList = getExercises();
    setExercises(exList);
    // Default to the first exercise if available
    if (exList.length > 0) {
      setSelectedExercise(exList[0].id);
    }
  }, []);

  useEffect(() => {
    if (!selectedExercise) return;

    const allLogs = getLogs();
    
    // 1. Filter logs for the selected exercise
    const relevantLogs = allLogs.filter(log => String(log.exerciseId) === String(selectedExercise));

    // 2. Process data for the chart
    // We want one point per day. If you did multiple sets, we take the HEAVIEST weight.
    const data = relevantLogs.map(log => {
      // Find the max weight in this specific workout session
      const maxWeight = Math.max(...log.sets.map(s => Number(s.weight)));
      return {
        date: log.date, // X-Axis
        weight: maxWeight // Y-Axis
      };
    });

    // 3. Sort by date (oldest to newest) so the line moves forward in time
    data.sort((a, b) => new Date(a.date) - new Date(b.date));

    setChartData(data);
  }, [selectedExercise]); // Re-run this whenever the user picks a new exercise

  // Custom Tooltip for the dark theme
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-800 border border-zinc-700 p-2 rounded shadow-xl text-xs">
          <p className="text-gray-400 mb-1">{label}</p>
          <p className="text-white font-bold text-lg">
            {payload[0].value} <span className="text-xs font-normal text-gray-400">lbs</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-md mx-auto text-white pb-10">
      <h2 className="text-xl font-bold mb-4 text-gray-300">Progress Trends</h2>

      {/* Selector */}
      <div className="mb-6">
        <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Select Exercise</label>
        <select 
          value={selectedExercise}
          onChange={(e) => setSelectedExercise(e.target.value)}
          className="w-full p-3 rounded bg-zinc-900 border border-zinc-800 text-white outline-none"
        >
          {exercises.map(ex => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
      </div>

      {/* The Chart */}
      <div className="h-64 w-full bg-zinc-900/50 rounded-lg border border-zinc-800 p-2 relative">
        {chartData.length < 2 ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm text-center px-8">
            Not enough data yet. Log this exercise on at least 2 different days to see a trend line!
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#666" 
                tick={{fontSize: 10}} 
                tickFormatter={(str) => str.slice(5)} // Show "10-27" instead of "2023-10-27"
              />
              <YAxis 
                stroke="#666" 
                tick={{fontSize: 10}} 
                domain={['auto', 'auto']} // Zoom in on the data range
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="weight" 
                stroke="#fff" 
                strokeWidth={3}
                dot={{ r: 4, fill: '#000', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}