import React, { useState, useRef, useEffect } from 'react';

export default function SearchableSelect({ options, value, onChange, placeholder = "Select..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // Filter options based on search text
  const filtered = options.filter(opt =>
    opt.name.toLowerCase().includes(search.toLowerCase())
  );

  // Find currently selected option object for display
  const selectedOption = options.find(o => String(o.id) === String(value));

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-black border border-zinc-700 rounded p-3 text-white cursor-pointer flex justify-between items-center select-none"
      >
        <span className={selectedOption ? "text-white" : "text-zinc-500"}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <span className="text-zinc-500 text-[10px] transform transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded shadow-xl max-h-60 flex flex-col animate-fade-in">
          {/* Search Input */}
          <input
            type="text"
            className="w-full p-3 bg-zinc-900 border-b border-zinc-700 text-white text-sm outline-none placeholder-zinc-600"
            placeholder="Search exercises..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking input
          />
          
          {/* Options List */}
          <div className="overflow-y-auto flex-1">
            {filtered.map(opt => (
              <div
                key={opt.id}
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                  setSearch(''); // Optional: Clear search on select
                }}
                className={`p-3 text-sm cursor-pointer hover:bg-zinc-800 transition border-b border-zinc-800/50 last:border-0 ${String(opt.id) === String(value) ? 'text-blue-400 font-bold bg-zinc-800/50' : 'text-zinc-300'}`}
              >
                {opt.name}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-4 text-center text-zinc-500 text-xs italic">
                No matches found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}