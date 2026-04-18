import React, { useState, useEffect, useRef } from 'react';

/**
 * SearchableSelect - A premium searchable dropdown component.
 * 
 * @param {Array} options - List of objects { value, label }
 * @param {String|Number} value - Current selected value
 * @param {Function} onChange - Callback when a value is selected
 * @param {String} placeholder - Input placeholder
 * @param {String} className - Additional CSS classes for the container
 */
export const SearchableSelect = ({ 
  options = [], 
  value = '', 
  onChange, 
  placeholder = 'Buscar...', 
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filteredOptions, setFilteredOptions] = useState([]);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Sync initial label if value exists
  useEffect(() => {
    const selected = options.find(opt => opt.value === value);
    if (selected && !isOpen) {
      setSearch(selected.label);
    } else if (!value && !isOpen) {
      setSearch('');
    }
  }, [value, options, isOpen]);

  // Filter options based on search text
  useEffect(() => {
    if (search.trim() === '') {
      setFilteredOptions(options);
    } else {
      const lowerSearch = search.toLowerCase();
      const filtered = options.filter(opt => 
        (opt.label || '').toLowerCase().includes(lowerSearch)
      );
      setFilteredOptions(filtered);
    }
  }, [search, options]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        // Reset search to current value's label if stopped editing
        const selected = options.find(opt => opt.value === value);
        setSearch(selected ? selected.label : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, options]);

  const handleSelect = (option) => {
    onChange(option.value);
    setSearch(option.label);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearch(''); // Clear to show all options or let user type fresh
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative group">
        <input
          ref={inputRef}
          type="text"
          className="w-full p-4 rounded-xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-white font-bold outline-none focus:border-[var(--color-acento)] transition-all pr-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          autoComplete="off"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 group-focus-within:opacity-100 transition-opacity">
          {isOpen ? '▲' : '▼'}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-[1000] top-full left-0 right-0 mt-2 bg-[#121212] border border-[var(--color-borde)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-200">
          <ul className="max-h-[250px] overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <li
                  key={opt.value}
                  className={`p-4 cursor-pointer transition-all border-b border-white/5 last:border-0 hover:bg-[var(--color-acento)] hover:text-black flex justify-between items-center ${
                    value === opt.value ? 'bg-[var(--color-acento)]/10 text-[var(--color-acento)]' : 'text-white/80'
                  }`}
                  onClick={() => handleSelect(opt)}
                >
                  <span className="font-bold">{opt.label}</span>
                  {value === opt.value && <span className="text-[10px]">✓</span>}
                </li>
              ))
            ) : (
              <li className="p-10 text-center opacity-30 italic text-sm">No hay resultados</li>
            )}
          </ul>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(197, 160, 89, 0.2); border-radius: 10px; }
      `}} />
    </div>
  );
};
