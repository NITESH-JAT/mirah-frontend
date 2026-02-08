// RegisterForm.jsx

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';

// --- GLOBAL STYLES ---
const globalStyles = `
  /* Custom Scrollbar */
  .custom-scrollbar::-webkit-scrollbar { width: 7px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; margin-block: 8rem; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  /* Toast Animations */
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  .animate-slide-in { animation: slideIn 0.4s ease-out forwards; }
  .animate-fade-out { animation: fadeOut 0.4s ease-out forwards; }
`;

// --- HELPER COMPONENTS ---

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

// 1. NOTIFICATION TOAST COMPONENT
const ToastNotification = ({ id, message, type, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => handleClose(), 10000); // 10 seconds auto-dismiss
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 400);
  };

  const isError = type === 'error';

  return (
    <div className={`
      relative w-[320px] bg-white rounded-[12px] shadow-xl border-l-4 p-4 mb-3 flex gap-3 items-start transition-all
      ${isError ? 'border-red-500' : 'border-green-500'}
      ${isExiting ? 'animate-fade-out' : 'animate-slide-in'}
    `}>
      {/* Icon */}
      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${isError ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
        {isError ? (
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" /></svg>
        ) : (
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pt-0.5">
        <h4 className={`font-serif text-[15px] font-bold leading-none mb-1 ${isError ? 'text-red-600' : 'text-primary-dark'}`}>
          {isError ? 'Action Failed' : 'Success'}
        </h4>
        <p className="text-gray-500 font-sans text-[13px] leading-snug">{message}</p>
      </div>

      {/* Close Button */}
      <button 
        onClick={handleClose} 
        className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors cursor-pointer p-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};

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
        
        {isMaxReached && (
          <span className="absolute right-12 top-1/2 -translate-y-1/2 text-[10px] text-orange-500 font-semibold bg-white px-1">
            Max 15
          </span>
        )}

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
    if (isOpen && searchInputRef.current) searchInputRef.current.focus();
    if (!isOpen) setSearchTerm(''); 
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue } });
    setIsOpen(false);
  };

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const lowerTerm = searchTerm.toLowerCase();
    
    return options.filter(opt => {
      if (opt.searchData) {
        return Object.values(opt.searchData).some(val => 
          String(val).toLowerCase().includes(lowerTerm)
        );
      }
      const label = opt.label || opt;
      const val = opt.value || opt;
      return String(label).toLowerCase().includes(lowerTerm) || String(val).toLowerCase().includes(lowerTerm);
    });
  }, [options, searchTerm]);

  const selectedOption = options.find(o => (o.value || o) === value);
  const selectedLabel = selectedOption ? (selectedOption.label || selectedOption.value) : (value || placeholder);
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
          <ul className="max-h-[160px] overflow-y-auto custom-scrollbar">
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

// --- MAIN REGISTER FORM ---
export const RegisterForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [countryData, setCountryData] = useState([]); 
  const [toasts, setToasts] = useState([]); // Store notifications
  
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    countryCode: '', phone: '', country: '', state: '', 
    pinCode: '', userType: 'customer', termsAccepted: false
  });

  // --- NOTIFICATION HELPERS ---
  const addToast = (message, type = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- LOAD DATA & GEO ---
  useEffect(() => {
    const initData = async () => {
      try {
        const response = await authService.getCountryCodes();
        const data = response.data || response;
        
        const validCountries = Array.isArray(data) ? data.map(c => ({
          dial_code: c.phoneCode,
          code: c.countryCode, 
          name: c.countryName
        })) : [];

        setCountryData(validCountries);

        try {
          const geoRes = await fetch('https://ipapi.co/json/');
          const geoInfo = await geoRes.json();
          
          if (geoInfo && validCountries.length > 0) {
            const matchedCode = validCountries.find(c => c.code === geoInfo.country_code);
            const matchedName = validCountries.find(c => c.name === geoInfo.country_name) || matchedCode;

            setFormData(prev => ({
              ...prev,
              countryCode: matchedCode ? matchedCode.dial_code : validCountries[0]?.dial_code,
              country: matchedName ? matchedName.name : validCountries[0]?.name
            }));
          } else {
             throw new Error("Geo failed");
          }
        } catch (geoErr) {
          // FALLBACK: Hardcode India (+91)
          if (validCountries.length > 0) {
            const india = validCountries.find(c => c.name === "India" || c.code === "IN" || c.dial_code === "+91");
            const fallback = india || validCountries[0];

            setFormData(prev => ({ 
              ...prev, 
              countryCode: fallback.dial_code, 
              country: fallback.name 
            }));
          }
        }

      } catch (e) {
        setCountryData([]);
      }
    };
    initData();
  }, []);

  // --- CROSS-TAB TERMS ---
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'termsAcceptedSignal') {
        setFormData(prev => {
           // Clear terms error if it exists
           setErrors(errs => {
             const newErrs = { ...errs };
             delete newErrs.termsAccepted;
             return newErrs;
           });
           return { ...prev, termsAccepted: true };
        });
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // --- HANDLERS ---

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    let val = type === 'checkbox' ? checked : value;

    if (name === 'phone') val = val.replace(/\D/g, ''); 
    if ((name === 'password' || name === 'confirmPassword') && val.length > 15) return; 

    // Update form
    setFormData(prev => ({ ...prev, [name]: val }));

    // CLEAR ERROR for this specific field immediately
    if (errors[name]) {
        setErrors(prev => {
            const newErrs = { ...prev };
            delete newErrs[name];
            return newErrs;
        });
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    
    // Only simple checks on blur (optional)
    if ((name === 'password' || name === 'confirmPassword') && value.length > 0 && value.length < 8) {
      setErrors(prev => ({ ...prev, [name]: "Must be at least 8 characters" }));
    }
  };

  const handleSubmit = async () => {
    // 1. Validate All
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!formData.firstName) newErrors.firstName = "Required";
    if (!formData.lastName) newErrors.lastName = "Required";
    
    if (!formData.email) newErrors.email = "Required";
    else if (!emailRegex.test(formData.email)) newErrors.email = "Invalid email format";

    if (!formData.phone) newErrors.phone = "Required";
    
    if (!formData.password) newErrors.password = "Required";
    else if (formData.password.length < 8) newErrors.password = "Must be at least 8 characters"; 

    if (formData.confirmPassword !== formData.password) newErrors.confirmPassword = "Passwords do not match";
    if (!formData.termsAccepted) newErrors.termsAccepted = "You must accept the terms";

    // 2. If Errors, Show them and stop
    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        // Optional: Show a toast summarizing that there are errors
        addToast("Please fill in all required fields correctly.", "error");
        return;
    }

    // 3. Submit
    setLoading(true);
    
    const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        countryCode: formData.countryCode, 
        phone: formData.phone,
        country: formData.country,         
        state: formData.state,
        pinCode: formData.pinCode,
        userType: formData.userType,
        city: null,
        address: null
    };

    try {
      await authService.signup(payload);
      addToast("Account created successfully!", "success");
      setTimeout(() => navigate('/verification'), 1000);
    } catch (err) {
      addToast(err.message || "Registration Failed", "error");
      setLoading(false);
    }
  };

  const codeOptions = useMemo(() => {
    return countryData.map(c => ({
      value: c.dial_code,
      label: `${c.code} ${c.dial_code}`,
      searchData: { code: c.code, dial: c.dial_code, name: c.name } 
    }));
  }, [countryData]);

  const countryNameOptions = useMemo(() => {
    return countryData.map(c => ({
      value: c.name,
      label: c.name,
      searchData: { name: c.name }
    }));
  }, [countryData]);

  return (
    <div className="w-full h-[calc(100dvh-140px)] lg:h-[82vh] overflow-y-auto custom-scrollbar pt-4 pb-4 px-1 relative">
      <style>{globalStyles}</style>

      {/* NOTIFICATION CONTAINER (Fixed Top Right) */}
      <div className="fixed top-6 right-6 z-50 flex flex-col items-end pointer-events-none">
        {/* Child elements enable pointer events */}
        <div className="pointer-events-auto">
             {toasts.map(toast => (
                <ToastNotification 
                    key={toast.id} 
                    id={toast.id} 
                    message={toast.message} 
                    type={toast.type} 
                    onClose={removeToast} 
                />
             ))}
        </div>
      </div>

      {/* HEADER */}
      <div className="shrink-0 text-center mb-6 lg:mb-4">
        <h1 className="font-serif text-[30px] lg:text-[24px] font-bold text-primary-dark mb-1">Create Your Account</h1>
        <p className="font-sans text-gray-400 text-[14px] lg:text-[11px] tracking-wide mb-2 lg:mb-1">Join our community of jewelry lovers.</p>
        
        {/* Role Switcher */}
        <div className="bg-gray-100 p-1.5 lg:p-0.5 rounded-xl lg:rounded-lg flex max-w-[320px] mx-auto">
          <button onClick={() => setFormData({...formData, userType: 'customer'})} className={`cursor-pointer flex-1 py-3 lg:py-1.5 rounded-lg lg:rounded-[6px] text-[14px] lg:text-[11px] font-semibold transition-all font-sans ${formData.userType === 'customer' ? 'bg-white text-primary-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>As a User</button>
          <button onClick={() => setFormData({...formData, userType: 'jeweller'})} className={`cursor-pointer flex-1 py-3 lg:py-1.5 rounded-lg lg:rounded-[6px] text-[14px] lg:text-[11px] font-semibold transition-all font-sans ${formData.userType === 'jeweller' ? 'bg-white text-primary-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>As a Jeweller</button>
        </div>
      </div>

      {/* FORM BODY */}
      <div className="flex flex-col gap-4 lg:gap-3 mb-6">
        <div className="flex gap-4 lg:gap-2.5">
          <InputField required name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} error={errors.firstName} />
          <InputField required name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} error={errors.lastName} />
        </div>
        
        <InputField required name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} error={errors.email} />
        
        <div className="flex gap-4 lg:gap-2.5">
          {/* Country Code Select */}
          <div className="w-[120px] lg:w-[100px] shrink-0">
             <CustomSelect
                placeholder="Code"
                value={formData.countryCode}
                onChange={(e) => setFormData(p => ({...p, countryCode: e.target.value}))}
                options={codeOptions}
             />
          </div>
          <InputField required name="phone" type="tel" placeholder="Phone Number" value={formData.phone} onChange={handleChange} error={errors.phone} />
        </div>

        {/* Independent Country Select */}
        <CustomSelect
            placeholder="Select Country"
            value={formData.country}
            onChange={(e) => setFormData(p => ({...p, country: e.target.value}))}
            options={countryNameOptions}
        />

        <div className="flex gap-4 lg:gap-2.5">
          <InputField name="state" placeholder="State" value={formData.state} onChange={handleChange} />
          <InputField name="pinCode" placeholder="Zip Code" value={formData.pinCode} onChange={handleChange} />
        </div>

        <div className="flex flex-col gap-4 lg:gap-2.5 mt-2">
            <PasswordInput required name="password" placeholder="Password" value={formData.password} onChange={handleChange} onBlur={handleBlur} error={errors.password} />
            <PasswordInput required name="confirmPassword" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleChange} onBlur={handleBlur} error={errors.confirmPassword} />
        </div>
      </div>

      {/* FOOTER */}
      <div className="shrink-0">
        <div className="flex items-center gap-2 mb-5 lg:mb-2 px-1">
          <input 
            type="checkbox" 
            name="termsAccepted"
            checked={formData.termsAccepted}
            onChange={handleChange}
            className={`w-4 h-4 rounded border-gray-300 focus:ring-primary-dark cursor-pointer ${errors.termsAccepted ? 'ring-2 ring-red-500' : 'text-primary-dark'}`}
          />
          <label className={`text-[12px] font-sans ${errors.termsAccepted ? 'text-red-500' : 'text-gray-500'}`}>
              I agree to the 
              <a 
                href="/terms" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary-dark font-bold cursor-pointer hover:underline mx-1"
              >
                Terms & Conditions
              </a> 
              <span className="text-red-500">*</span>
          </label>
        </div>

        <button 
          onClick={handleSubmit} 
          disabled={loading} 
          className="w-full cursor-pointer bg-primary-dark text-white py-4 lg:py-3 rounded-full lg:rounded-[20px] text-[16px] lg:text-[13px] font-bold shadow-lg shadow-blue-900/20 active:scale-[0.98] hover:bg-primary-dark/90 transition-all font-sans disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Next'}
        </button>

        <p className="text-center text-[13px] lg:text-[10px] text-gray-500 mt-5 lg:mt-2 font-sans font-medium">
          Already have an account? <span onClick={() => navigate('/login')} className="text-primary-dark font-bold cursor-pointer hover:underline">Login</span>
        </p>
      </div>
    </div>
  );
};