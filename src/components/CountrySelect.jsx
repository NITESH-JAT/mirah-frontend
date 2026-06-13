import React, { useEffect, useMemo, useRef, useState } from 'react';

function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

export function countrySelectOptionsFromLookup(countries = []) {
  return countries
    .filter((c) => c?.name)
    .map((c) => ({
      value: String(c.name),
      label: String(c.name),
      searchData: { name: c.name, code: c.code },
    }));
}

/**
 * Searchable country dropdown (stores country name as value, same as signup).
 */
export default function CountrySelect({
  label,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  placeholder = 'Select country',
  countries = [],
  className = '',
  variant = 'profile',
  hasError = false,
  required = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);
  const isDisabled = disabled || readOnly;

  const close = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  useClickOutside(wrapperRef, close);

  useEffect(() => {
    if (isOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [isOpen]);

  const options = useMemo(() => {
    const base = countrySelectOptionsFromLookup(countries);
    const current = String(value ?? '').trim();
    if (current && !base.some((o) => o.value === current)) {
      return [{ value: current, label: current, searchData: { name: current } }, ...base];
    }
    return base;
  }, [countries, value]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const lower = searchTerm.toLowerCase();
    return options.filter((opt) => {
      if (opt.searchData) {
        return Object.values(opt.searchData).some((val) =>
          String(val).toLowerCase().includes(lower)
        );
      }
      return String(opt.label).toLowerCase().includes(lower);
    });
  }, [options, searchTerm]);

  const selectedOption = options.find((o) => o.value === value);
  const selectedLabel = selectedOption?.label || value || placeholder;
  const isPlaceholder = !value;

  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue } });
    close();
  };

  const triggerClass =
    variant === 'checkout'
      ? `mt-1 w-full px-4 py-3 rounded-xl border bg-white text-[12px] font-semibold focus:outline-none cursor-pointer flex items-center pr-9
          ${isDisabled ? 'bg-cream text-muted cursor-not-allowed' : ''}
          ${hasError ? 'border-amber-300' : 'border-pale'}
          ${isPlaceholder ? 'text-muted' : 'text-mid'}`
      : variant === 'auth'
        ? `w-full px-5 py-4 lg:px-4 lg:py-3 pr-10 lg:pr-8 rounded-[12px] lg:rounded-[8px] border border-pale text-[15px] lg:text-[14px] font-medium bg-white transition-all cursor-pointer flex items-center
          ${isDisabled ? 'bg-cream text-muted cursor-not-allowed' : 'hover:border-pale focus:border-walnut focus:ring-1 focus:ring-walnut/10'}
          ${isPlaceholder ? 'text-muted' : 'text-mid'}`
        : `w-full px-4 py-3 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-walnut/20 transition-all cursor-pointer flex items-center pr-9
          ${isDisabled ? 'bg-cream border-pale text-muted cursor-not-allowed' : 'bg-white border-pale focus:border-walnut text-mid'}
          ${isPlaceholder && !isDisabled ? 'text-muted' : ''}`;

  const listClass =
    variant === 'auth'
      ? 'rounded-[12px] lg:rounded-[8px]'
      : 'rounded-xl';

  return (
    <div className={`space-y-1.5 ${className}`} ref={wrapperRef}>
      {label ? (
        <label className="text-[11px] font-medium text-ink uppercase tracking-wide block">
          {label}
          {required ? ' *' : ''}
        </label>
      ) : null}
      <div className="relative">
        <div
          role="button"
          tabIndex={isDisabled ? -1 : 0}
          onClick={() => !isDisabled && setIsOpen(!isOpen)}
          onKeyDown={(e) => {
            if (isDisabled) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsOpen((o) => !o);
            }
          }}
          className={triggerClass}
        >
          <span className="truncate">{selectedLabel}</span>
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
        {isOpen && !isDisabled && (
          <div
            className={`absolute top-full left-0 w-full mt-1 bg-white border border-pale shadow-sm z-[60] overflow-hidden flex flex-col ${listClass}`}
          >
            <div className="p-2 border-b border-pale bg-cream/50">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search country..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-1.5 text-[12px] border border-pale rounded-md focus:outline-none focus:border-walnut font-sans bg-white"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <ul className="max-h-[200px] overflow-y-auto custom-scrollbar">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <li
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`px-4 py-2.5 text-[13px] text-mid hover:bg-cream cursor-pointer border-b border-pale last:border-0
                      ${opt.value === value ? 'bg-walnut/5 text-ink font-semibold' : ''}`}
                  >
                    {opt.label}
                  </li>
                ))
              ) : (
                <li className="px-4 py-3 text-[12px] text-muted italic text-center">No results found</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
