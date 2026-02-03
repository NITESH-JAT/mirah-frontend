import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';

// ============================================================================
// 0. GLOBAL STYLES (Scrollbar Hiding)
// ============================================================================
const scrollbarHideStyles = `
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;

// ============================================================================
// 1. SHARED UI COMPONENTS
// ============================================================================

function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

// InputField (Supports onBlur for validation)
const InputField = ({ label, className, type="text", readOnly, required, error, onBlur, ...props }) => (
  <div className={`w-full ${className}`}>
    {label && (
      <label className="block text-gray-700 text-sm font-medium mb-1">
        {label} {required && <span className="text-red-500 text-sm ml-1">*</span>}
      </label>
    )}
    <input
      type={type}
      readOnly={readOnly}
      onBlur={onBlur}
      {...props}
      className={`w-full px-5 py-4 lg:px-3 lg:py-2.5 rounded-[12px] lg:rounded-[8px] border text-gray-700 text-[15px] lg:text-[13px] font-medium placeholder:text-gray-400 focus:outline-none focus:ring-1 transition-all font-sans 
        ${readOnly ? 'bg-gray-50 text-gray-500' : 'bg-white'}
        ${error 
          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' 
          : 'border-gray-200 focus:border-primary-dark focus:ring-primary-dark/10'
        }
      `}
    />
    {error && <p className="text-red-500 text-[11px] mt-1 ml-1">{error}</p>}
  </div>
);

// PasswordInput (Max length logic + Cursor Fix + Min length error)
const PasswordInput = ({ placeholder, value, onChange, onBlur, name, required, error }) => {
  const [show, setShow] = useState(false);
  const isMaxReached = value && value.length === 15;

  return (
    <div className="w-full">
       <div className="relative">
        <input
          type={show ? "text" : "password"}
          name={name}
          maxLength={15}
          placeholder={required ? `${placeholder} *` : placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className={`w-full px-5 py-4 lg:px-3 lg:py-2.5 rounded-[12px] lg:rounded-[8px] border text-gray-700 text-[15px] lg:text-[13px] font-medium placeholder:text-gray-400 focus:outline-none focus:ring-1 transition-all font-sans pr-10
            ${error 
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' 
              : 'border-gray-200 focus:border-primary-dark focus:ring-primary-dark/10'
            }
          `}
        />
        
        {/* Max Length Indicator (Only shown when 15 chars reached) */}
        {isMaxReached && (
          <span className="absolute right-12 top-1/2 -translate-y-1/2 text-[10px] text-orange-500 font-semibold bg-white px-1">
            Max 15
          </span>
        )}

        {/* Eye Toggle with Hand Cursor */}
        <button 
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-dark transition-colors cursor-pointer"
        >
          {show ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          )}
        </button>
      </div>
      {error && <p className="text-red-500 text-[11px] mt-1 ml-1">{error}</p>}
    </div>
  );
};

const CustomSelect = ({ options, placeholder, value, onChange, disabled, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);

  useClickOutside(wrapperRef, () => setIsOpen(false));

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) setSearchTerm(''); 
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue } });
    setIsOpen(false);
  };

  const filteredOptions = useMemo(() => {
    return options.filter(opt => {
      const label = opt.label || opt;
      return String(label).toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [options, searchTerm]);

  const selectedLabel = options.find(o => (o.value || o) === value)?.label || value || placeholder;
  const isPlaceholder = !value;

  return (
    <div className={`relative w-full ${className}`} ref={wrapperRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-5 py-4 lg:px-3 lg:py-2.5 pr-10 lg:pr-8 rounded-[12px] lg:rounded-[8px] border border-gray-200 text-[15px] lg:text-[13px] font-medium bg-white focus:outline-none focus:border-primary-dark focus:ring-1 focus:ring-primary-dark/10 transition-all cursor-pointer flex items-center
          ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'hover:border-gray-300'}
          ${isPlaceholder ? 'text-gray-400' : 'text-gray-700'}
        `}
      >
        <span className="truncate">{selectedLabel}</span>
      </div>
      <div className="absolute right-4 lg:right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 lg:w-3.5 lg:h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-[12px] lg:rounded-[8px] shadow-xl z-50 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-50 bg-gray-50/50">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 text-[13px] lg:text-[12px] border border-gray-200 rounded-md focus:outline-none focus:border-primary-dark font-sans bg-white"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <ul className="max-h-[140px] overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const val = opt.value || opt;
                const lab = opt.label || opt;
                return (
                  <li 
                    key={idx}
                    onClick={() => handleSelect(val)}
                    className={`px-5 py-3 lg:px-3 lg:py-2.5 text-[15px] lg:text-[13px] text-gray-700 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0
                      ${val === value ? 'bg-primary-dark/5 text-primary-dark font-semibold' : ''}
                    `}
                  >
                    {lab}
                  </li>
                );
              })
            ) : (
              <li className="px-5 py-3 lg:px-3 lg:py-2.5 text-[13px] text-gray-400 italic text-center">No results found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

// --- Terms Modal (With Auto-Agree Logic) ---
const TermsModal = ({ onClose, onAgree }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary-dark/30 backdrop-blur-sm animate-fade-in">
    <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl relative flex flex-col max-h-[80vh]">
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
        <h2 className="text-xl font-serif font-bold text-primary-dark">Terms of Service</h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="overflow-y-auto text-sm text-gray-600 font-sans space-y-4 pr-2 custom-scrollbar flex-1">
        <p>1. <strong>Acceptance:</strong> By using our services, you agree to these terms.</p>
        <p>2. <strong>Verification:</strong> You must verify your phone and email to access the platform.</p>
        <p>3. <strong>Data:</strong> Your data is stored securely and never shared.</p>
        <p className="text-xs text-gray-400 mt-4">Updated: Feb 2026</p>
      </div>
      <div className="mt-6 pt-2 border-t border-gray-100">
        <button 
          onClick={() => { onAgree(); }} 
          className="w-full bg-primary-dark text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-900/10 hover:bg-primary-dark/90 transition-all cursor-pointer"
        >
          I Understand & Agree
        </button>
      </div>
    </div>
  </div>
);

// ============================================================================
// 2. LOGIN FORM 
// ============================================================================
export const LoginForm = () => {
  const [rawValue, setRawValue] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [maxLength, setMaxLength] = useState(10);
  const [countriesList, setCountriesList] = useState([]);
  const [isCodeOpen, setIsCodeOpen] = useState(false);
  const [codeSearch, setCodeSearch] = useState('');
  const codeWrapperRef = useRef(null);
  const codeSearchRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [cursorPos, setCursorPos] = useState(null);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useClickOutside(codeWrapperRef, () => setIsCodeOpen(false));

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await authService.getCountryCodes();
        const data = response.data || response; 
        
        const mapped = Array.isArray(data) ? data.map(c => ({
          dialCode: c.phoneCode, 
          code: c.countryCode, 
          name: c.countryName
        })) : [];

        setCountriesList(mapped.length ? mapped : [{ dialCode: '+91', code: 'IN', name: 'India' }]);
      } catch (e) {
        setCountriesList([{ dialCode: '+91', code: 'IN', name: 'India' }]);
      }
    };
    fetchCountries();
  }, []);

  useEffect(() => {
    if (isCodeOpen && codeSearchRef.current) codeSearchRef.current.focus();
    if (!isCodeOpen) setCodeSearch('');
  }, [isCodeOpen]);

  const handleCountrySelect = (code) => {
    setCountryCode(code);
    setIsCodeOpen(false);
  };

  const handleInput = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, maxLength);
    setRawValue(val);
    setCursorPos(e.target.selectionStart);
  };

  const handleNext = () => {
    if (rawValue.length === maxLength) {
      localStorage.setItem('mirah_pending_phone', `${countryCode} ${rawValue}`);
      navigate('/otp');
    }
  };

  const renderDigit = (index) => {
    const isFilled = index < rawValue.length;
    const showCursor = isFocused && cursorPos === index;
    const showPlaceholder = !isFilled && !showCursor;
    const digit = isFilled ? rawValue[index] : (showPlaceholder ? '0' : '');

    return (
      <div key={index} className="relative flex justify-center items-center w-[22px] lg:w-[26px] h-[50px]">
        <span className={`${isFilled ? 'text-primary-dark' : 'text-[#E5E7EB]'} transition-colors duration-100 font-serif text-[34px] lg:text-[40px] leading-none`}>
          {digit}
        </span>
        {showCursor && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`h-8 lg:h-9 w-[2px] bg-primary-dark animate-pulse ${isFilled ? '-translate-x-3' : ''}`}></div>
          </div>
        )}
      </div>
    );
  };

  const filteredCountries = countriesList.filter(c => 
    c.name?.toLowerCase().includes(codeSearch.toLowerCase()) || 
    c.dialCode?.includes(codeSearch) ||
    c.code?.toLowerCase().includes(codeSearch.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col h-[85vh] lg:h-[80vh] pt-4 lg:pt-8">
      <style>{scrollbarHideStyles}</style>

      {/* 1. HEADER */}
      <div className="shrink-0 text-center mb-10 px-4">
        <h1 className="font-serif text-[32px] lg:text-[36px] font-medium text-primary-dark mb-3 lg:mb-4 tracking-tight">Enter your phone number</h1>
        <div className="font-sans text-gray-400 text-[14px] leading-relaxed">
          <p>Join us today and unlock a world of possibilities.</p>
          <p className="hidden lg:block">Sign up in seconds!</p>
        </div>
      </div>

      {/* 2. BODY */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex items-center justify-center px-4 mb-4">
        <div className="w-full max-w-[400px] flex items-end justify-center gap-4 lg:gap-5">
            <div ref={codeWrapperRef} className="relative shrink-0 h-[50px] flex items-end cursor-pointer gap-2 z-50" onClick={() => setIsCodeOpen(!isCodeOpen)}>
              <span className="text-primary-dark font-medium select-none text-[34px] lg:text-[40px] font-serif leading-none transition-colors">{countryCode}</span>
              <div className="pb-1.5 lg:pb-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className={`w-3.5 h-3.5 text-gray-300 transition-all ${isCodeOpen ? 'text-primary-dark rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </div>
              {isCodeOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl w-[220px] max-h-[300px] overflow-hidden flex flex-col z-[100]">
                   <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                     <input ref={codeSearchRef} type="text" placeholder="Search..." className="w-full px-2 py-1.5 text-[12px] border border-gray-200 rounded focus:outline-none focus:border-primary-dark font-sans" value={codeSearch} onChange={(e) => setCodeSearch(e.target.value)} onClick={(e) => e.stopPropagation()} />
                   </div>
                   <ul className="overflow-y-auto custom-scrollbar text-left flex-1">
                     {filteredCountries.map((c, i) => (
                       <li key={i} onClick={(e) => { e.stopPropagation(); handleCountrySelect(c.dialCode); }} className={`px-4 py-3 text-[14px] text-gray-700 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 font-sans flex items-center justify-between gap-2 ${c.dialCode === countryCode ? 'bg-primary-dark/5 text-primary-dark font-semibold' : ''}`}>
                         <span className="truncate flex-1">{c.name}</span>
                         <span className="text-gray-400 text-xs whitespace-nowrap">{c.code} {c.dialCode}</span>
                       </li>
                     ))}
                   </ul>
                </div>
              )}
            </div>
            
            <div className="relative cursor-text flex items-end h-[50px]" onClick={() => inputRef.current?.focus()}>
              <div className="flex items-end tracking-widest flex-nowrap justify-center gap-[1px] lg:gap-1">
                {Array.from({ length: maxLength }).map((_, i) => renderDigit(i))}
              </div>
              <input ref={inputRef} type="tel" value={rawValue} onChange={handleInput} onSelect={(e) => setCursorPos(e.target.selectionStart)} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10" autoFocus />
            </div>
        </div>
      </div>

      {/* 3. FOOTER */}
      <div className="shrink-0 w-full max-w-[360px] lg:max-w-[400px] mx-auto pb-6">
        <button onClick={handleNext} disabled={rawValue.length < maxLength} className="w-full cursor-pointer bg-primary-dark text-white py-4 lg:py-4 rounded-full text-[16px] lg:text-[16px] font-medium shadow-xl shadow-blue-900/10 active:scale-[0.98] hover:bg-primary-dark/90 transition-all disabled:opacity-50">Next</button>
        <div className="mt-6 text-center">
          <p className="text-[14px] lg:text-[13px] text-gray-400 font-sans">Don't have account? <span onClick={() => navigate('/register')} className="text-primary-dark font-bold cursor-pointer hover:underline">Sign Up</span></p>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. OTP FORM
// ============================================================================
export const OTPForm = () => {
  const [otp, setOtp] = useState(['', '', '', '']);
  const inputs = useRef([]);
  const navigate = useNavigate();
  const phone = localStorage.getItem('mirah_pending_phone');

  const handleChange = (val, i) => {
    if (!/^\d*$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[i] = val.slice(-1);
    setOtp(newOtp);
    if (val && i < 3) inputs.current[i + 1].focus();
  };

  const handleVerify = () => { if (otp.join('').length === 4) navigate('/dashboard/profile'); };
  const handleResend = () => { setOtp(['','','','']); inputs.current[0]?.focus(); };

  return (
    <div className="w-full flex flex-col h-[85vh] lg:h-[80vh] pt-4 lg:pt-8 text-center">
      <style>{scrollbarHideStyles}</style>

      {/* 1. Header */}
      <div className="shrink-0 mb-8">
        <h1 className="font-serif text-[34px] lg:text-[36px] font-medium text-primary-dark mb-4 lg:mb-3">OTP Code</h1>
        <p className="text-gray-500 text-[15px] lg:text-[14px] font-sans px-4">Enter the OTP sent to <span className="font-bold text-primary-dark whitespace-nowrap">{phone}</span></p>
      </div>

      {/* 2. Body */}
      <div className="flex-1 flex flex-col justify-center items-center overflow-y-auto no-scrollbar">
        <div className="flex justify-center gap-5 lg:gap-4 mb-10">
          {otp.map((digit, i) => (
            <input key={i} ref={el => inputs.current[i] = el} type="text" inputMode="numeric" className="w-16 h-16 lg:w-16 lg:h-16 border border-gray-200 rounded-[18px] lg:rounded-xl text-center text-[28px] lg:text-3xl font-bold text-primary-dark focus:border-primary-dark focus:ring-1 focus:ring-primary-dark/20 outline-none shadow-sm transition-all" value={digit} onChange={(e) => handleChange(e.target.value, i)} onKeyDown={(e) => e.key === 'Backspace' && !otp[i] && i > 0 && inputs.current[i-1].focus()} />
          ))}
        </div>
      </div>

      {/* 3. Footer */}
      <div className="shrink-0 w-full max-w-[360px] mx-auto pb-6">
        <button onClick={handleVerify} disabled={otp.join('').length < 4} className="w-full cursor-pointer bg-primary-dark text-white py-4 lg:py-4 rounded-full text-[16px] lg:text-[16px] font-medium shadow-lg shadow-blue-900/20 hover:bg-primary-dark/90 transition-all disabled:opacity-50">Verify</button>
        <div className="mt-6">
          <button onClick={handleResend} className="text-gray-400 text-[14px] lg:text-[13px] font-medium hover:text-primary-dark transition-colors cursor-pointer py-2">Didn't receive the code? <span className="underline decoration-gray-300 underline-offset-4 hover:decoration-primary-dark">Resend OTP</span></button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. REGISTER FORM (Updated Logic & Schema Alignment)
// ============================================================================
export const RegisterForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [countryCodes, setCountryCodes] = useState([]);
  
  // Validation State
  const [errors, setErrors] = useState({});
  const [isValid, setIsValid] = useState(false);

  // SCHEMAL UPDATE: zipCode -> pinCode
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    countryCode: '', phone: '', country: '', state: '', 
    pinCode: '', userType: 'customer', termsAccepted: false
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await authService.getCountryCodes();
        const data = response.data || response;

        const validCodes = Array.isArray(data) ? data.map(c => ({
          dial_code: c.phoneCode,
          code: c.countryCode,
          name: c.countryName
        })) : [];

        setCountryCodes(validCodes);
        if(validCodes.length > 0) {
           setFormData(prev => ({ ...prev, countryCode: validCodes[0].dial_code, country: validCodes[0].name }));
        }
      } catch (e) {
        setCountryCodes([]);
      }
    };
    loadData();
  }, []);

  const handleCountryCodeChange = (code) => {
    const selected = countryCodes.find(c => c.dial_code === code);
    setFormData({ 
      ...formData, 
      countryCode: code, 
      country: selected ? selected.name : '' 
    });
  };

  const handleTermsAgree = () => {
    setFormData(prev => ({ ...prev, termsAccepted: true }));
    setShowTerms(false);
    // Re-validate to clear error immediately
    const updatedData = { ...formData, termsAccepted: true };
    validateForm(updatedData);
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    let val = type === 'checkbox' ? checked : value;

    // --- Specific Field Logic ---

    // Phone: Number only
    if (name === 'phone') {
        val = val.replace(/\D/g, ''); 
    }

    // Password: Hard max length 15
    if (name === 'password' || name === 'confirmPassword') {
        if (val.length > 15) return; 
    }

    setFormData(prev => {
      const updated = { ...prev, [name]: val };
      validateForm(updated); 
      return updated;
    });
  };

  // Triggered when user leaves a password field
  const handleBlur = (e) => {
    const { name, value } = e.target;
    if ((name === 'password' || name === 'confirmPassword') && value.length > 0 && value.length < 8) {
      setErrors(prev => ({ ...prev, [name]: "Must be at least 8 characters" }));
    }
  };

  // VALIDATION LOGIC
  const validateForm = (data) => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!data.firstName) newErrors.firstName = "Required";
    
    if (!data.email) {
        newErrors.email = "Required";
    } else if (!emailRegex.test(data.email)) {
        newErrors.email = "Invalid email format";
    }

    if (!data.phone) newErrors.phone = "Required";
    
    // Password Rules
    if (!data.password) {
      newErrors.password = "Required";
    } else if (data.password.length < 8) {
      newErrors.password = "Must be at least 8 characters"; 
    }

    if (data.confirmPassword !== data.password) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!data.termsAccepted) newErrors.termsAccepted = "Must accept terms";

    setErrors(newErrors);
    setIsValid(Object.keys(newErrors).length === 0);
  };

  const handleSubmit = async () => {
    if (!isValid) return; 

    setLoading(true);
    
    // CONSTRUCT PAYLOAD: Match Backend Schema & Clean Data
    const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        countryCode: formData.countryCode,
        phone: formData.phone,
        country: formData.country,
        state: formData.state,
        pinCode: formData.pinCode, // Changed from zipCode
        userType: formData.userType,
        // Backend Requirements (Not in Frontend) -> Send Null
        city: null,
        address: null
    };

    try {
      await authService.signup(payload);
      navigate('/verification');
    } catch (err) {
      alert("Registration Failed: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    // LAYOUT FIX: Reduced margins to increase form height
    <div className="w-full flex flex-col h-[85vh] lg:h-[82vh] pt-4">
      <style>{scrollbarHideStyles}</style>
      
      {/* Terms Modal Overlay */}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} onAgree={handleTermsAgree} />}

      {/* 1. HEADER (Reduced Margins) */}
      <div className="shrink-0 text-center mb-2 lg:mb-1 px-1">
        <h1 className="font-serif text-[30px] lg:text-[24px] font-bold text-primary-dark mb-1">Create Your Account</h1>
        <p className="font-sans text-gray-400 text-[14px] lg:text-[11px] tracking-wide mb-2 lg:mb-1">Join our community of jewelry lovers.</p>
        
        {/* Role Switcher */}
        <div className="bg-gray-100 p-1.5 lg:p-0.5 rounded-xl lg:rounded-lg flex max-w-[320px] mx-auto mb-2">
          <button onClick={() => setFormData({...formData, userType: 'customer'})} className={`cursor-pointer flex-1 py-3 lg:py-1.5 rounded-lg lg:rounded-[6px] text-[14px] lg:text-[11px] font-semibold transition-all font-sans ${formData.userType === 'customer' ? 'bg-white text-primary-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>As a User</button>
          <button onClick={() => setFormData({...formData, userType: 'jeweller'})} className={`cursor-pointer flex-1 py-3 lg:py-1.5 rounded-lg lg:rounded-[6px] text-[14px] lg:text-[11px] font-semibold transition-all font-sans ${formData.userType === 'jeweller' ? 'bg-white text-primary-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>As a Jeweller</button>
        </div>
      </div>

      {/* 2. FORM BODY (Scrollable area increased) */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-1 pb-2">
        <div className="flex flex-col gap-4 lg:gap-3">
          <div className="flex gap-4 lg:gap-2.5">
            <InputField required name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} error={errors.firstName} />
            <InputField name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} />
          </div>
          
          <InputField required name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} error={errors.email} />
          
          {/* Country Code + Phone */}
          <div className="flex gap-4 lg:gap-2.5">
            <div className="w-[120px] lg:w-[100px] shrink-0">
               <CustomSelect
                placeholder="Code"
                value={formData.countryCode}
                onChange={(e) => handleCountryCodeChange(e.target.value)}
                options={countryCodes.map(c => ({ value: c.dial_code, label: `${c.code} ${c.dial_code}` }))}
               />
            </div>
            {/* Added restriction to numbers via handleChange */}
            <InputField required name="phone" type="tel" placeholder="Phone Number" value={formData.phone} onChange={handleChange} error={errors.phone} />
          </div>

          {/* Country (Full Width) */}
          <InputField name="country" placeholder="Country" value={formData.country} readOnly className="bg-gray-50" />

          {/* State + Pin (Grouped 50/50, No 'Opt' text, Renamed state to pinCode, Placeholder Zip Code) */}
          <div className="flex gap-4 lg:gap-2.5">
            <InputField name="state" placeholder="State" value={formData.state} onChange={handleChange} />
            <InputField name="pinCode" placeholder="Zip Code" value={formData.pinCode} onChange={handleChange} />
          </div>

          {/* Password Area */}
          <div className="flex flex-col gap-4 lg:gap-2.5 mt-2">
             <PasswordInput required name="password" placeholder="Password" value={formData.password} onChange={handleChange} onBlur={handleBlur} error={errors.password} />
             <PasswordInput required name="confirmPassword" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleChange} onBlur={handleBlur} error={errors.confirmPassword} />
          </div>
        </div>
      </div>

      {/* 3. FOOTER (Reduced bottom margin/padding) */}
      <div className="shrink-0 pt-2 pb-1.5 lg:pb-0.5">
        {/* Terms Checkbox */}
        <div className="flex items-center gap-2 mb-3 lg:mb-2 px-1">
          <input 
            type="checkbox" 
            name="termsAccepted"
            checked={formData.termsAccepted}
            onChange={handleChange}
            className={`w-4 h-4 rounded border-gray-300 focus:ring-primary-dark cursor-pointer ${errors.termsAccepted ? 'ring-2 ring-red-500' : 'text-primary-dark'}`}
          />
          <label className={`text-[12px] font-sans ${errors.termsAccepted ? 'text-red-500' : 'text-gray-500'}`}>
             I agree to the <span onClick={() => setShowTerms(true)} className="text-primary-dark font-bold cursor-pointer hover:underline">Terms & Conditions</span> <span className="text-red-500">*</span>
          </label>
        </div>

        <button 
          onClick={handleSubmit} 
          disabled={loading || !isValid} 
          className="w-full cursor-pointer bg-primary-dark text-white py-4 lg:py-3 rounded-full lg:rounded-[8px] text-[16px] lg:text-[13px] font-bold shadow-lg shadow-blue-900/20 active:scale-[0.98] hover:bg-primary-dark/90 transition-all font-sans disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Next'}
        </button>

        <p className="text-center text-[13px] lg:text-[10px] text-gray-500 mt-3 lg:mt-2 font-sans font-medium">
          Already have an account? <span onClick={() => navigate('/login')} className="text-primary-dark font-bold cursor-pointer hover:underline">Login</span>
        </p>
      </div>
    </div>
  );
};