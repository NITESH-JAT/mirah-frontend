import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDialCodeOptionLabel, isoCountryCodeToFlagEmoji } from '../../utils/countryFlag';

/*
 * Shared building blocks for the auth screens (login, forgot password, signup, verification).
 * Visual language follows the marketing site (arviahstudio.com): Plus Jakarta Sans, tight
 * heading tracking, pill buttons, 24px cards, walnut on cream.
 */

const fieldBase =
  'w-full h-12 rounded-[14px] border bg-white px-4 font-jakarta text-[15px] text-ink placeholder:text-muted transition-colors lg:h-10 lg:rounded-[11px] lg:px-3.5 lg:text-[13px]';
const fieldBorder = (error) => (error ? 'border-red-400' : 'border-pale hover:border-soft');

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

// --- Toasts ---

function Toast({ id, message, type, onClose }) {
  const [isExiting, setIsExiting] = useState(false);
  const close = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 400);
  };
  useEffect(() => {
    const timer = setTimeout(close, 10000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isError = type === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`relative mb-3 flex w-[min(340px,calc(100vw-32px))] items-start gap-3 rounded-2xl border border-pale bg-white p-4 shadow-[0_12px_32px_rgba(58,42,30,0.10)] ${
        isExiting ? 'animate-fade-out' : 'animate-slide-in'
      } lg:mb-2 lg:gap-2.5`}
    >
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          isError ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
        }`}
        aria-hidden
      >
        {isError ? (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm-.75 4.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zM10 14.5a1 1 0 110-2 1 1 0 010 2z" /></svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.58l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
        )}
      </span>
      <div className="flex-1 pt-0.5">
        <p className={`font-jakarta text-[14px] font-semibold leading-tight ${isError ? 'text-red-700' : 'text-ink'} lg:text-[12.5px]`}>
          {isError ? 'Something went wrong' : 'Done'}
        </p>
        <p className="mt-1 whitespace-pre-line font-jakarta text-[13px] leading-snug text-mid lg:text-[12px]">{message}</p>
      </div>
      <button type="button" onClick={close} aria-label="Dismiss" className="shrink-0 cursor-pointer p-1 text-muted hover:text-ink">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 lg:h-3.5 lg:w-3.5"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
      </button>
    </div>
  );
}

export function ToastStack({ toasts, onClose }) {
  // Portal so toasts sit above the sticky auth header instead of inside the page's stacking context.
  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col items-end sm:right-6 sm:top-6">
      <div className="pointer-events-auto">
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onClose={onClose} />
        ))}
      </div>
    </div>,
    document.body
  );
}

// --- Typography ---

export function AuthHeading({ eyebrow, title, subtitle, size = 'lg', className = '' }) {
  const titleSize =
    size === 'lg' ? 'text-[30px] leading-[1.1] sm:text-[40px] lg:text-[32px]' : 'text-[26px] leading-[1.15] sm:text-[32px] lg:text-[26px]';
  return (
    <div className={className}>
      {eyebrow ? (
        <p className="mb-3 font-jakarta text-[13px] font-semibold tracking-[-0.01em] text-walnut lg:mb-2 lg:text-[12px]">{eyebrow}</p>
      ) : null}
      <h1 className={`font-jakarta font-bold tracking-[-0.04em] text-ink text-balance ${titleSize}`}>{title}</h1>
      {subtitle ? (
        <p className="mt-3 font-jakarta text-[15px] leading-[1.6] text-mid lg:mt-2.5 lg:text-[13px]">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function TextLink({ children, className = '', ...props }) {
  const Tag = props.href ? 'a' : 'button';
  return (
    <Tag
      {...(Tag === 'button' ? { type: 'button' } : {})}
      {...props}
      className={`cursor-pointer font-jakarta font-semibold text-ink underline decoration-soft underline-offset-[3px] transition-colors hover:decoration-ink ${className}`}
    >
      {children}
    </Tag>
  );
}

// --- Fields ---

export function Field({ label, htmlFor, error, children, className = '' }) {
  return (
    <div className={`w-full min-w-0 ${className}`}>
      {label ? (
        <label htmlFor={htmlFor} className="mb-1.5 block font-jakarta text-[13px] font-semibold text-ink lg:mb-1 lg:text-[12px]">
          {label}
        </label>
      ) : null}
      {children}
      {error ? <p className="mt-1.5 font-jakarta text-[12px] text-red-600 lg:mt-1 lg:text-[11px]">{error}</p> : null}
    </div>
  );
}

export function TextInput({ error, className = '', ...props }) {
  return (
    <input
      {...props}
      aria-invalid={error ? true : undefined}
      className={`${fieldBase} ${fieldBorder(error)} ${className}`}
    />
  );
}

export function PasswordInput({ error, maxLength = 15, autoComplete = 'current-password', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={show ? 'text' : 'password'}
        maxLength={maxLength}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        className={`${fieldBase} ${fieldBorder(error)} pr-12 lg:pr-10`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:text-ink lg:h-8 lg:w-8"
      >
        {show ? (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-[18px] w-[18px] lg:h-[15px] lg:w-[15px]"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-[18px] w-[18px] lg:h-[15px] lg:w-[15px]"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        )}
      </button>
    </div>
  );
}

/**
 * Searchable dropdown. Options: { value, label, code?, searchData? }.
 * Options carrying an ISO `code` render as dial codes with a flag.
 */
export function SearchSelect({ options, placeholder, value, onChange, disabled, error, searchPlaceholder = 'Search…' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);

  const close = () => {
    setIsOpen(false);
    setSearchTerm('');
  };
  useClickOutside(wrapperRef, close);

  useEffect(() => {
    if (isOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((opt) => {
      if (opt.searchData) {
        return Object.values(opt.searchData).some((v) => String(v).toLowerCase().includes(term));
      }
      return String(opt.label ?? opt.value).toLowerCase().includes(term) || String(opt.value).toLowerCase().includes(term);
    });
  }, [options, searchTerm]);

  const isDial = options.some((o) => o?.code || o?.searchData?.code);
  const selected = options.find((o) => o.value === value);
  const selectedIso = selected?.code || selected?.searchData?.code;
  const selectedText = selected
    ? isDial
      ? selected.value
      : selected.label || selected.value
    : value || placeholder;

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`${fieldBase} ${fieldBorder(error)} flex cursor-pointer items-center pr-10 text-left disabled:cursor-not-allowed disabled:bg-cream ${
          value ? 'text-ink' : 'text-muted'
        } lg:pr-8`}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {isDial && selectedIso ? (
            <span className="text-[16px] leading-none lg:text-[14px]" aria-hidden>
              {isoCountryCodeToFlagEmoji(selectedIso)}
            </span>
          ) : null}
          <span className="truncate">{selectedText}</span>
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-transform ${isOpen ? 'rotate-180' : ''} lg:h-3.5 lg:w-3.5`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {isOpen && !disabled ? (
        <div
          className={`absolute left-0 top-full z-50 mt-1.5 overflow-hidden rounded-[14px] border border-pale bg-white shadow-[0_16px_40px_rgba(58,42,30,0.12)] ${
            isDial ? 'w-[260px] max-w-[calc(100vw-40px)]' : 'w-full'
          } lg:mt-1 lg:rounded-[11px]`}
        >
          <div className="border-b border-pale p-2">
            <input
              ref={searchInputRef}
              type="text"
              autoComplete="off"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-[10px] border border-pale bg-cream/60 px-3 font-jakarta text-[14px] text-ink lg:h-8 lg:text-[12.5px]"
            />
          </div>
          <ul role="listbox" className="custom-scrollbar max-h-[220px] overflow-y-auto py-1">
            {filteredOptions.length ? (
              filteredOptions.map((opt) => {
                const iso = opt.code || opt.searchData?.code;
                const text = isDial
                  ? `${formatDialCodeOptionLabel({ phoneCode: opt.value }) || opt.value}${opt.countryName ? `  ${opt.countryName}` : ''}`
                  : opt.label || opt.value;
                const active = opt.value === value;
                return (
                  <li
                    key={`${opt.value}-${iso || ''}`}
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange({ target: { value: opt.value } });
                      close();
                    }}
                    className={`flex cursor-pointer items-center gap-2 px-4 py-2.5 font-jakarta text-[14px] hover:bg-cream ${
                      active ? 'bg-blush/60 font-semibold text-ink' : 'text-mid'
                    } lg:px-3.5 lg:text-[12.5px]`}
                  >
                    {isDial && iso ? (
                      <span className="text-[15px] leading-none lg:text-[13px]" aria-hidden>
                        {isoCountryCodeToFlagEmoji(iso)}
                      </span>
                    ) : null}
                    <span className="truncate">{text}</span>
                  </li>
                );
              })
            ) : (
              <li className="px-4 py-3 text-center font-jakarta text-[13px] text-muted lg:px-3.5 lg:text-[12px]">No results found</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function PhoneInput({ codeOptions, countryCode, onCountryCodeChange, error, ...inputProps }) {
  return (
    <div className="flex gap-2.5 lg:gap-2">
      <div className="w-[124px] shrink-0 lg:w-[112px]">
        <SearchSelect
          options={codeOptions}
          placeholder="Code"
          value={countryCode}
          onChange={(e) => onCountryCodeChange(e.target.value)}
          searchPlaceholder="Search country…"
        />
      </div>
      <TextInput type="tel" inputMode="tel" maxLength={20} error={error} {...inputProps} />
    </div>
  );
}

export function Checkbox({ checked, onChange, name, error, children }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 lg:gap-2.5">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className={`mt-[2px] h-[18px] w-[18px] shrink-0 cursor-pointer rounded-[5px] border accent-walnut ${error ? 'border-red-400' : 'border-soft'} lg:h-[15px] lg:w-[15px]`}
      />
      <span className={`font-jakarta text-[14px] leading-[1.5] ${error ? 'text-red-600' : 'text-mid'} lg:text-[12.5px]`}>{children}</span>
    </label>
  );
}

// --- Controls ---

export function SegmentedTabs({ options, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-full border border-pale bg-cream p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`flex h-10 flex-1 cursor-pointer items-center justify-center rounded-full font-jakarta text-[14px] font-semibold transition-colors ${
              active ? 'bg-walnut text-blush shadow-[0_4px_12px_rgba(107,85,69,0.25)]' : 'text-mid hover:text-ink'
            } lg:h-8 lg:text-[12.5px]`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export const ArrowRight = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 lg:h-3.5 lg:w-3.5" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h12m0 0l-4.5-4.5M16 10l-4.5 4.5" />
  </svg>
);

export const ArrowLeft = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 lg:h-3.5 lg:w-3.5" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 10H4m0 0l4.5-4.5M4 10l4.5 4.5" />
  </svg>
);

const buttonBase =
  'inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full px-6 font-jakarta text-[15px] font-semibold tracking-[-0.01em] transition-all duration-200 hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 lg:h-10 lg:px-5 lg:text-[13px]';

export function PrimaryButton({ children, className = '', type = 'button', ...props }) {
  return (
    <button type={type} {...props} className={`${buttonBase} bg-walnut text-blush hover:bg-[#5d4a3c] ${className}`}>
      {children}
    </button>
  );
}

export function OutlineButton({ children, className = '', type = 'button', ...props }) {
  return (
    <button type={type} {...props} className={`${buttonBase} border border-pale bg-white/70 text-ink hover:border-soft hover:bg-white ${className}`}>
      {children}
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-4 lg:my-5" aria-hidden>
      <span className="h-px flex-1 bg-pale" />
      <span className="font-jakarta text-[12px] font-semibold uppercase tracking-[0.12em] text-muted lg:text-[11px]">or</span>
      <span className="h-px flex-1 bg-pale" />
    </div>
  );
}

export function StepProgress({ step, total = 2 }) {
  return (
    <div className="flex items-center gap-4">
      <span className="shrink-0 font-jakarta text-[13px] font-semibold text-mid lg:text-[12px]">
        Step {step} of {total}
      </span>
      <div className="flex flex-1 gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-walnut' : 'bg-pale'}`} />
        ))}
      </div>
    </div>
  );
}

export function RoleCard({ selected, onSelect, title, description }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full cursor-pointer items-start gap-3 rounded-[18px] border p-3.5 text-left transition-colors sm:p-4 ${
        selected ? 'border-walnut bg-blush/50' : 'border-pale bg-white hover:border-soft'
      } lg:gap-2.5 lg:rounded-[14px] lg:p-3`}
    >
      <span
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
          selected ? 'border-walnut' : 'border-soft'
        } lg:h-[15px] lg:w-[15px]`}
        aria-hidden
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-walnut" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block font-jakarta text-[15px] font-bold tracking-[-0.01em] text-ink lg:text-[13px]">{title}</span>
        <span className="mt-0.5 block font-jakarta text-[12.5px] leading-[1.45] text-mid lg:text-[11px]">{description}</span>
      </span>
    </button>
  );
}

export function AuthCard({ children, className = '' }) {
  return (
    <div
      className={`rounded-[24px] border border-pale bg-white p-5 shadow-[0_24px_60px_rgba(58,42,30,0.06)] sm:p-7 ${className} lg:rounded-[20px] lg:p-4`}
    >
      {children}
    </div>
  );
}
