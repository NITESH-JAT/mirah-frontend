import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

// --- Helper: Click Outside Hook ---
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

// --- Shared: Standard Input Field ---
const InputField = ({ label, className, ...props }) => (
  <div className={`w-full ${className}`}>
    <input
      {...props}
      className="w-full px-5 py-4 lg:px-3 lg:py-2.5 rounded-[12px] lg:rounded-[8px] border border-gray-200 text-gray-700 text-[15px] lg:text-[13px] font-medium placeholder:text-gray-400 focus:outline-none focus:border-primary-dark focus:ring-1 focus:ring-primary-dark/10 transition-all font-sans"
    />
  </div>
);

// --- Shared: Searchable Custom Dropdown ---
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
    if (!isOpen) setSearchTerm(''); // Reset search on close
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

  const selectedLabel = options.find(o => (o.value || o) === value)?.label || 
                        options.find(o => (o.value || o) === value) || 
                        value || 
                        placeholder;
  
  const isPlaceholder = !value;

  return (
    <div className={`relative w-full ${className}`} ref={wrapperRef}>
      {/* Trigger Area */}
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

      {/* Dropdown List */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-[12px] lg:rounded-[8px] shadow-xl z-50 overflow-hidden flex flex-col">
          
          {/* Search Input (Sticky Top) */}
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
            {/* Show Placeholder Option if needed */}
            <li 
               onClick={() => handleSelect("")}
               className="px-5 py-3 lg:px-3 lg:py-2.5 text-[15px] lg:text-[13px] text-gray-400 hover:bg-gray-50 cursor-pointer border-b border-gray-50"
            >
              {placeholder}
            </li>

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

// --- Login Form ---
export const LoginForm = () => {
  const [rawValue, setRawValue] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [maxLength, setMaxLength] = useState(10);
  const [countriesList, setCountriesList] = useState([]);
  
  // Custom Select State for Login
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
      const data = await authService.getCountries();
      setCountriesList(data);
    };
    fetchCountries();
  }, []);

  useEffect(() => {
    if (isCodeOpen && codeSearchRef.current) {
      codeSearchRef.current.focus();
    }
    if (!isCodeOpen) setCodeSearch('');
  }, [isCodeOpen]);

  const handleCountrySelect = (code) => {
    setCountryCode(code);
    const country = countriesList.find(c => c.dialCode === code);
    if (country) setMaxLength(country.phoneLength || 10);
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
      <div key={index} className="relative flex justify-center items-end w-[22px] lg:w-[26px] h-[50px]">
        <span className={`${isFilled ? 'text-primary-dark' : 'text-[#E5E7EB]'} transition-colors duration-100 font-serif text-[34px] lg:text-[40px] leading-none`}>
          {digit}
        </span>
        {showCursor && (
          <div className="absolute inset-0 flex items-end justify-center pointer-events-none pb-[8px] lg:pb-[9px]">
            <div className={`h-8 lg:h-9 w-[2px] bg-primary-dark animate-pulse ${isFilled ? '-translate-x-3' : ''}`}></div>
          </div>
        )}
      </div>
    );
  };

  const filteredCountries = countriesList.filter(c => 
    c.name.toLowerCase().includes(codeSearch.toLowerCase()) || 
    c.dialCode.includes(codeSearch) ||
    c.code.toLowerCase().includes(codeSearch.toLowerCase())
  );

  return (
    <div className="text-center w-full h-full flex flex-col items-center justify-center py-6 lg:py-0 relative">
      
      {/* Header */}
      <div className="w-full mb-20 lg:mb-28 mt-4 lg:mt-0">
        <h1 className="font-serif text-[32px] lg:text-[36px] font-medium text-primary-dark mb-3 lg:mb-4 tracking-tight">
          Enter your phone number
        </h1>
        <div className="font-sans text-gray-400 text-[14px] lg:text-[14px] leading-relaxed px-6">
          <p>Join us today and unlock a world of possibilities.</p>
          <p className="hidden lg:block">Sign up in seconds!</p>
        </div>
      </div>

      {/* Input Section */}
      <div className="w-full mb-20 lg:mb-28 px-4">
        <div className="w-full max-w-[400px] mx-auto flex items-end justify-center gap-4 lg:gap-5">
            
            {/* A. Searchable Country Code Trigger */}
            <div 
              ref={codeWrapperRef}
              className="relative shrink-0 h-[50px] flex items-end cursor-pointer gap-2 z-50"
              onClick={() => setIsCodeOpen(!isCodeOpen)}
            >
              <span className="text-primary-dark font-medium select-none text-[34px] lg:text-[40px] font-serif leading-none transition-colors">
                 {countryCode}
              </span>

              <div className="pb-1.5 lg:pb-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className={`w-3.5 h-3.5 text-gray-300 transition-all ${isCodeOpen ? 'text-primary-dark rotate-180' : ''}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
              
              {/* Custom Searchable Dropdown */}
              {isCodeOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl w-[180px] overflow-hidden flex flex-col">
                   {/* Search Bar */}
                   <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                     <input 
                        ref={codeSearchRef}
                        type="text" 
                        placeholder="Search country..." 
                        className="w-full px-2 py-1.5 text-[12px] border border-gray-200 rounded focus:outline-none focus:border-primary-dark font-sans"
                        value={codeSearch}
                        onChange={(e) => setCodeSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                     />
                   </div>

                   <ul className="max-h-[140px] overflow-y-auto custom-scrollbar text-left">
                     {filteredCountries.map((c, i) => (
                       <li 
                         key={i} 
                         onClick={(e) => {
                           e.stopPropagation();
                           handleCountrySelect(c.dialCode);
                         }}
                         className={`px-4 py-3 text-[14px] text-gray-700 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 font-sans flex items-center justify-between gap-2
                           ${c.dialCode === countryCode ? 'bg-primary-dark/5 text-primary-dark font-semibold' : ''}
                         `}
                       >
                         <span className="truncate flex-1">{c.name}</span>
                         <span className="text-gray-400 text-xs">{c.dialCode}</span>
                       </li>
                     ))}
                     {filteredCountries.length === 0 && (
                       <li className="px-4 py-3 text-[12px] text-gray-400 text-center">No match</li>
                     )}
                   </ul>
                </div>
              )}
            </div>
            
            {/* B. Digits Input Area */}
            <div 
               className="relative cursor-text flex items-end h-[50px]"
               onClick={() => inputRef.current?.focus()}
            >
              <div className="flex items-end tracking-widest flex-nowrap justify-center gap-[1px] lg:gap-1">
                {Array.from({ length: maxLength }).map((_, i) => renderDigit(i))}
              </div>
              <input
                ref={inputRef}
                type="tel"
                value={rawValue}
                onChange={handleInput}
                onSelect={(e) => setCursorPos(e.target.selectionStart)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"
                autoFocus
              />
            </div>
        </div>
      </div>

      {/* Button Section */}
      <div className="w-full max-w-[360px] lg:max-w-[400px]">
        <button 
          onClick={handleNext}
          disabled={rawValue.length < maxLength}
          className="w-full cursor-pointer bg-primary-dark text-white py-4 lg:py-4 rounded-full text-[16px] lg:text-[16px] font-medium shadow-xl shadow-blue-900/10 active:scale-[0.98] hover:bg-primary-dark/90 transition-all disabled:opacity-50"
        >
          Next
        </button>
        <div className="mt-8 lg:mt-8">
          <p className="text-[14px] lg:text-[13px] text-gray-400 font-sans">
            Don't have account? <span onClick={() => navigate('/register')} className="text-primary-dark font-bold cursor-pointer hover:underline">Sign Up</span>
          </p>
        </div>
      </div>
    </div>
  );
};

// --- OTP Form ---
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

  const handleVerify = () => {
    if (otp.join('') === '1234') navigate('/dashboard/profile'); 
  };

  const handleResend = () => {
    alert("OTP Resent!");
    setOtp(['','','','']);
    inputs.current[0]?.focus();
  };

  return (
    <div className="w-full text-center h-full flex flex-col justify-between lg:justify-center py-6 lg:py-0">
      <div className="hidden lg:block"></div>
      <div className="mt-10 lg:mt-0">
        <h1 className="font-serif text-[34px] lg:text-[32px] font-medium text-primary-dark mb-3 lg:mb-2">OTP Code</h1>
        <p className="text-gray-500 text-[15px] lg:text-[14px] font-sans px-4">
          Enter the OTP sent to <span className="font-bold text-primary-dark whitespace-nowrap">{phone}</span>
        </p>
      </div>
      <div className="flex flex-col gap-10 lg:gap-12 my-auto w-full max-w-[360px] mx-auto">
        <div className="flex justify-center gap-4 lg:gap-4">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => inputs.current[i] = el}
              type="text"
              inputMode="numeric"
              className="w-16 h-16 lg:w-14 lg:h-14 border border-gray-200 rounded-[18px] lg:rounded-xl text-center text-[28px] lg:text-2xl font-bold text-primary-dark focus:border-primary-dark focus:ring-1 focus:ring-primary-dark/20 outline-none shadow-sm transition-all"
              value={digit}
              onChange={(e) => handleChange(e.target.value, i)}
              onKeyDown={(e) => e.key === 'Backspace' && !otp[i] && i > 0 && inputs.current[i-1].focus()}
            />
          ))}
        </div>
        <button 
          onClick={handleVerify}
          disabled={otp.join('').length < 4}
          className="w-full cursor-pointer bg-primary-dark text-white py-4 lg:py-4 rounded-full text-[16px] lg:text-[16px] font-medium shadow-lg shadow-blue-900/20 hover:bg-primary-dark/90 transition-all disabled:opacity-50"
        >
          Verify
        </button>
      </div>
      <div className="mb-10 lg:mb-0">
        <button 
          onClick={handleResend}
          className="text-gray-400 text-[14px] lg:text-[13px] font-medium hover:text-primary-dark transition-colors cursor-pointer py-2"
        >
          Didn't receive the code? <span className="underline decoration-gray-300 underline-offset-4 hover:decoration-primary-dark">Resend OTP</span>
        </button>
      </div>
    </div>
  );
};

// --- Register Form ---
export const RegisterForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [countriesList, setCountriesList] = useState([]);
  const [statesList, setStatesList] = useState([]);
  const [citiesList, setCitiesList] = useState([]);

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    countryCode: '', phone: '', country: '', state: '', city: '', address: '', pinCode: '',
    userType: 'customer' 
  });

  useEffect(() => {
    const fetchCountries = async () => {
      const data = await authService.getCountries();
      setCountriesList(data);
    };
    fetchCountries();
  }, []);

  useEffect(() => {
    if (!formData.country) { setStatesList([]); return; }
    const fetchStates = async () => {
      const states = await authService.getStates(formData.country);
      setStatesList(states.map(s => s.name));
    };
    fetchStates();
    setFormData(prev => ({ ...prev, state: '', city: '' }));
  }, [formData.country]);

  useEffect(() => {
    if (!formData.state) { setCitiesList([]); return; }
    const fetchCities = async () => {
      const cities = await authService.getCities(formData.country, formData.state);
      setCitiesList(cities);
    };
    fetchCities();
    setFormData(prev => ({ ...prev, city: '' }));
  }, [formData.state]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    if (formData.password !== formData.confirmPassword) return alert("Passwords do not match");
    if (!formData.firstName || !formData.email || !formData.phone) return alert("Please fill required fields");

    setLoading(true);
    try {
      await authService.register(formData);
      navigate('/dashboard/profile');
    } catch (err) {
      alert(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 lg:gap-0">
      <div className="text-center mb-4 lg:mb-2">
        <h1 className="font-serif text-[30px] lg:text-[24px] font-bold text-primary-dark mb-1">Create Your Account</h1>
        <p className="font-sans text-gray-400 text-[14px] lg:text-[11px] tracking-wide">Join our community of jewelry lovers.</p>
      </div>

      <div className="bg-gray-100 p-1.5 lg:p-0.5 rounded-xl lg:rounded-lg mb-4 lg:mb-3 flex">
        <button 
          onClick={() => setFormData({...formData, userType: 'customer'})} 
          className={`cursor-pointer flex-1 py-3 lg:py-1.5 rounded-lg lg:rounded-[6px] text-[14px] lg:text-[11px] font-semibold transition-all font-sans 
            ${formData.userType === 'customer' ? 'bg-white text-primary-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
        >
          As a User
        </button>
        <button 
          onClick={() => setFormData({...formData, userType: 'jeweller'})} 
          className={`cursor-pointer flex-1 py-3 lg:py-1.5 rounded-lg lg:rounded-[6px] text-[14px] lg:text-[11px] font-semibold transition-all font-sans 
            ${formData.userType === 'jeweller' ? 'bg-white text-primary-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
        >
          As a Jeweller
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:gap-3">
        <div className="flex gap-4 lg:gap-2.5">
          <InputField name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} />
          <InputField name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} />
        </div>
        <InputField name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} />
        <div className="flex gap-4 lg:gap-2.5">
          <div className="w-[120px] lg:w-[90px] shrink-0">
             {/* Searchable Select for Code */}
             <CustomSelect
              placeholder="Code"
              value={formData.countryCode}
              onChange={(e) => setFormData({...formData, countryCode: e.target.value})}
              options={countriesList.map(c => ({ value: c.dialCode, label: `${c.code} ${c.dialCode}` }))}
             />
          </div>
          <InputField name="phone" type="tel" placeholder="Phone Number" value={formData.phone} onChange={handleChange} />
        </div>
        <div className="flex gap-4 lg:gap-2.5">
          {/* Searchable Select for Country */}
          <CustomSelect 
            placeholder="Country" 
            value={formData.country} 
            onChange={(e) => setFormData({...formData, country: e.target.value})} 
            options={countriesList.map(c => c.name)} 
          />
          {/* Searchable Select for State */}
          <CustomSelect 
            placeholder="State" 
            value={formData.state} 
            onChange={(e) => setFormData({...formData, state: e.target.value})} 
            options={statesList} 
            disabled={!formData.country} 
          />
        </div>
        <div className="flex gap-4 lg:gap-2.5">
          <div className="flex-[2]">
            {/* Searchable Select for City */}
            <CustomSelect 
              placeholder="City" 
              value={formData.city} 
              onChange={(e) => setFormData({...formData, city: e.target.value})} 
              options={citiesList} 
              disabled={!formData.state} 
            />
          </div>
          <div className="flex-1">
            <InputField name="pinCode" placeholder="Pin Code" value={formData.pinCode} onChange={handleChange} />
          </div>
        </div>
        <InputField name="address" placeholder="Address" value={formData.address} onChange={handleChange} />
        <div className="flex gap-4 lg:gap-2.5">
           <InputField name="password" type="password" placeholder="Password" value={formData.password} onChange={handleChange} />
          <InputField name="confirmPassword" type="password" placeholder="Conf. Password" value={formData.confirmPassword} onChange={handleChange} />
        </div>
      </div>

      <button 
        onClick={handleSubmit} 
        disabled={loading}
        className="w-full cursor-pointer bg-primary-dark text-white py-4 lg:py-3 mt-8 lg:mt-5 rounded-full lg:rounded-[8px] text-[16px] lg:text-[13px] font-bold shadow-lg shadow-blue-900/20 active:scale-[0.98] hover:bg-primary-dark/90 transition-all font-sans disabled:opacity-70"
      >
        {loading ? 'Creating...' : 'Next'}
      </button>

      <p className="text-center text-[13px] lg:text-[10px] text-gray-500 mt-6 lg:mt-3 font-sans font-medium">
        Already have an account? <span onClick={() => navigate('/login')} className="text-primary-dark font-bold cursor-pointer hover:underline">Login</span>
      </p>
    </div>
  );
};