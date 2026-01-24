import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';


const FloatingLabelInput = ({ label, type = "text", value, onChange, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value && value.length > 0;

  return (
    <div className="relative mb-4 lg:mb-2.5">
      <input
        {...props}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`peer w-full px-4 lg:px-3.5 py-3.5 lg:py-2 border rounded-xl bg-white text-gray-800 text-[15px] lg:text-[12px] focus:outline-none focus:ring-1 transition-all font-sans
          ${isFocused || hasValue ? 'border-primary-dark ring-primary-dark/10' : 'border-gray-200'}
        `}
      />
      <label
        className={`absolute left-4 lg:left-3.5 transition-all duration-200 pointer-events-none bg-white px-1 font-sans leading-none
          ${(isFocused || hasValue) 
            ? '-top-2 lg:-top-1.5 text-xs lg:text-[9px] text-primary-dark font-medium' 
            : 'top-4 lg:top-2.5 text-gray-400 text-[15px] lg:text-[12px]'}
        `}
      >
        {label}
      </label>
    </div>
  );
};

// --- Login Form ---
// --- Login Form ---
export const LoginForm = () => {
  const [rawValue, setRawValue] = useState('');
  const [isFocused, setIsFocused] = useState(false); // 1. New state for focus
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const handleInput = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setRawValue(val);
  };

  const handleNext = () => {
    if (rawValue.length === 10) {
      localStorage.setItem('mirah_pending_phone', rawValue);
      navigate('/otp');
    }
  };

  // 2. Updated renderDigit to show blinking cursor
  const renderDigit = (index) => {
    const isFilled = index < rawValue.length;
    // The cursor should appear on the current empty slot (index === length)
    // OR at the last slot if the input is full (index === 9 and length === 10)? 
    // Usually it sits on the next available slot.
    const isCursorPos = index === rawValue.length; 
    
    const digit = isFilled ? rawValue[index] : '0';

    return (
      <div key={index} className="relative flex justify-center items-center w-[18px] lg:w-[20px]">
        {/* The Digit */}
        <span 
          className={`${isFilled ? 'text-primary-dark' : 'text-[#E5E7EB]'} transition-colors duration-100`}
        >
          {digit}
        </span>

        {/* The Blinking Cursor Line */}
        {isFocused && isCursorPos && (
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="h-8 w-0.5 bg-primary-dark animate-pulse translate-y-[1px]"></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="text-center w-full h-full flex flex-col items-center pt-4 lg:pt-0">
      
      <h1 className="font-serif text-[30px] lg:text-[36px] font-medium text-primary-dark mb-2 lg:mb-2 tracking-tight whitespace-nowrap">
        Enter your phone number
      </h1>
      
      <div className="font-sans text-gray-400 text-[13px] lg:text-[14px] leading-relaxed mb-12 lg:mb-10">
        <p>Join us today and unlock a world of possibilities.</p>
        <p>Sign up in seconds!</p>
      </div>
      
      {/* Container for input */}
      <div 
        className="relative w-full max-w-[320px] mt-20 mb-30 lg:mt-15 mb-26 cursor-text mx-auto group" 
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex items-center justify-center gap-4 font-serif text-[32px] lg:text-[34px]">
          <span className="text-primary-dark font-medium select-none">+91</span>
          
          <div className="flex items-center tracking-widest">
            <div className="flex gap-1"> {/* Added gap-1 for better spacing */}
              {[0, 1, 2, 3, 4].map(i => renderDigit(i))}
            </div>
            
            <span className="text-[#E5E7EB] mx-2">-</span>
            
            <div className="flex gap-1">
              {[5, 6, 7, 8, 9].map(i => renderDigit(i))}
            </div>
          </div>
        </div>

        <input
          ref={inputRef}
          type="tel"
          value={rawValue}
          onChange={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer font-serif text-[32px] text-center z-10"
          autoFocus
        />
      </div>

      <button 
        onClick={handleNext}
        disabled={rawValue.length < 10}
        className="w-full cursor-pointer bg-primary-dark text-white py-4 lg:py-3.5 rounded-full text-[16px] lg:text-[15px] font-medium shadow-xl shadow-blue-900/10 active:scale-[0.98] hover:bg-primary-dark/90 hover:shadow-blue-900/20 transition-all disabled:opacity-50 disabled:shadow-none font-sans"
      >
        Next
      </button>

      <p className="mt-8 lg:mt-8 text-[13px] text-gray-400 font-sans pb-4 lg:pb-0">
        Don't have account? <span onClick={() => navigate('/register')} className="text-primary-dark font-bold cursor-pointer hover:underline">Sign Up</span>
      </p>
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

  const handleVerify = async () => {
    if (otp.join('') === '1234') {
      const result = { success: true }; 
      if (result.success) navigate('/welcome');
      else navigate('/register');
    }
  };

  return (

    <div className="w-full min-h-[80vh] flex flex-col justify-between lg:block lg:min-h-0 lg:h-auto text-left lg:text-center pt-4 lg:pt-0">
      
      <div>
        
        {/* Heading */}
        <h1 className="font-serif text-[32px] lg:text-[32px] font-medium text-primary-dark mb-2 lg:mb-2">
          OTP Code
        </h1>

        <div className="flex flex-col items-start lg:items-center justify-center gap-1 mb-10 lg:mb-8 font-sans">
          <div className="flex items-center gap-1.5 text-[14px] lg:text-[13px] text-gray-500">
            <span>Enter the OTP sent to</span>
          </div>
          <div className="flex items-center gap-2 text-[14px] lg:text-[13px]">
            <span className="font-bold text-primary-dark">
              +91 {phone?.replace(/(\d{5})(\d{5})/, '$1 $2')}
            </span>
            <button className="text-primary-dark hover:text-blue-700 transition-colors" onClick={() => navigate('/login')}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M21.731 2.269a2.625 2.625 0 113.712 3.712l-9.376 9.376-2.067.58a.5.5 0 01-.613-.613l.58-2.067 9.376-9.376zM9.375 12.25l-2.067.58a.5.5 0 01-.613-.613l.58-2.067 7.5-7.5-6.643 6.643a3.565 3.565 0 00-.736.96l-1.355 2.71a1.125 1.125 0 001.272 1.272l2.71-1.355a3.565 3.565 0 00.96-.736L12.25 9.375l-2.875 2.875z" />
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75.38-1.745 1.056-2.617l-1.42-1.42A11.218 11.218 0 0012 .75C5.787.75.75 5.787.75 12s5.037 11.25 11.25 11.25S23.25 18.213 23.25 12c0-.62-.05-1.229-.146-1.821l-1.47 1.47c.075.446.116.903.116 1.366 0 4.556-3.694 8.25-8.25 8.25S3.75 16.556 3.75 12 7.444 3.75 12 3.75c1.45 0 2.816.376 4.01 1.03l1.1-1.1A11.21 11.21 0 0012 2.25z" clipRule="evenodd" opacity="0" /> 
                <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* OTP Inputs */}
        <div className="flex justify-start lg:justify-center gap-4 lg:gap-4 mb-5 lg:mb-4">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => inputs.current[i] = el}
              type="text"
              inputMode="numeric"
              className="w-12 h-12 lg:w-12 lg:h-12 border border-gray-200 rounded-[14px] text-center text-2xl lg:text-xl font-bold text-primary-dark bg-white focus:border-primary-dark focus:ring-1 focus:ring-primary-dark/20 outline-none transition-all font-sans shadow-sm"
              value={digit}
              onChange={(e) => handleChange(e.target.value, i)}
              onKeyDown={(e) => e.key === 'Backspace' && !otp[i] && i > 0 && inputs.current[i-1].focus()}
            />
          ))}
        </div>

        <div className="text-[13px] lg:text-[12px] text-gray-400 font-sans mb-8">
          Didn't receive the code? <span className="text-primary-dark font-bold cursor-pointer hover:underline">Resend OTP</span>
        </div>
      </div>

      <div className="pb-6 lg:pb-0 w-full lg:mt-24">
        <button 
          onClick={handleVerify}
          disabled={otp.join('').length < 4}
          className="w-full cursor-pointer bg-primary-dark text-white py-4 lg:py-3.5 rounded-full text-[16px] lg:text-[15px] font-medium shadow-lg shadow-blue-900/20 active:scale-[0.98] hover:bg-primary-dark/90 transition-all disabled:opacity-50 font-sans"
        >
          Verify
        </button>
      </div>
    </div>
  );
};

// --- Register Form ---
export const RegisterForm = () => {
  const [role, setRole] = useState('user');
  const [cities, setCities] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCities, setShowCities] = useState(false);
  const cityWrapperRef = useRef(null);
  
  const [formData, setFormData] = useState({ 
    fullName: '', 
    phone: localStorage.getItem('mirah_pending_phone') || '', 
    city: '', 
    password: '', 
    confirmPassword: '' 
  });
  const navigate = useNavigate();

  useEffect(() => {
    authService.getUAECities().then(setCities);
    const handleClickOutside = (event) => {
      if (cityWrapperRef.current && !cityWrapperRef.current.contains(event.target)) {
        setShowCities(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCities = cities.filter(c => c.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleRegister = async () => {
    if (formData.password !== formData.confirmPassword) return alert("Passwords mismatch");
    await authService.register({ ...formData, role });
    navigate('/welcome');
  };

  return (
    <div className="w-full">
      <div className="text-center mb-6 lg:mb-4">
        <h1 className="font-serif text-[32px] lg:text-[26px] font-bold text-primary-dark mb-1 lg:mb-0.5">Create Your Account</h1>
        <p className=" text-center font-sans text-gray-400 text-sm lg:text-[12px]">Join our community of jewelry lovers and artisans.</p>
      </div>

      <div className="bg-[#EBEAEA] p-1 lg:p-0.5 rounded-xl lg:rounded-[8px] mb-6 lg:mb-3 flex">
        <button 
          onClick={() => setRole('user')} 
          className={`flex-1 cursor-pointer py-2.5 lg:py-1.5 rounded-lg lg:rounded-[6px] text-sm lg:text-[11px] font-semibold transition-all font-sans 
            ${role === 'user' ? 'bg-white text-primary-dark shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/50'}`}
        >
          As a User
        </button>
        <button 
          onClick={() => setRole('seller')} 
          className={`flex-1 cursor-pointer py-2.5 lg:py-1.5 rounded-lg lg:rounded-[6px] text-sm lg:text-[11px] font-semibold transition-all font-sans 
            ${role === 'seller' ? 'bg-white text-primary-dark shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/50'}`}
        >
          As a Jeweller
        </button>
      </div>


      <p className="text-center text-[13px] lg:text-[10px] text-gray-400 mb-8 lg:mb-4 leading-relaxed px-1">
        Mirah will help you find clients who are looking for custom jewelry so you can showcase your craft and grow your business
      </p>

      <FloatingLabelInput 
        label="Full Name" 
        value={formData.fullName} 
        onChange={e => setFormData({...formData, fullName: e.target.value})} 
      />
      
      <FloatingLabelInput 
        label="Phone Number" 
        value={formData.phone} 
        onChange={e => setFormData({...formData, phone: e.target.value})} 
      />
      
      <div className="relative mb-4 lg:mb-2.5" ref={cityWrapperRef}>
        <div className="relative">
          <input
            value={searchTerm}
            onFocus={() => setShowCities(true)}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowCities(true);
              if (e.target.value === '') setFormData({...formData, city: ''});
            }}

            className="peer w-full px-4 lg:px-3.5 py-3.5 lg:py-2 border border-gray-200 rounded-xl bg-white text-gray-800 text-[15px] lg:text-[12px] focus:outline-none focus:ring-1 focus:border-primary-dark focus:ring-primary-dark/10 transition-all font-sans"
          />
          <label className={`absolute left-4 lg:left-3.5 transition-all duration-200 pointer-events-none bg-white px-1 font-sans leading-none
            ${(showCities || searchTerm) 
              ? '-top-2 lg:-top-1.5 text-xs lg:text-[9px] text-primary-dark font-medium' 
              : 'top-4 lg:top-2.5 text-gray-400 text-[15px] lg:text-[12px]'}
          `}>
            Select City (UAE)
          </label>
           <div className="absolute right-4 lg:right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 lg:w-3 lg:h-3">
               <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
             </svg>
           </div>
        </div>
        
        {showCities && filteredCities.length > 0 && (
          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 max-h-48 lg:max-h-32 overflow-y-auto no-scrollbar">
            {filteredCities.map(city => (
              <div 
                key={city}
                className="px-5 lg:px-4 py-3 lg:py-2 hover:bg-gray-50 cursor-pointer text-sm lg:text-[12px] text-gray-600 border-b border-gray-50 last:border-0 font-sans"
                onClick={() => {
                  setFormData({...formData, city});
                  setSearchTerm(city);
                  setShowCities(false);
                }}
              >
                {city}
              </div>
            ))}
          </div>
        )}
      </div>

      <FloatingLabelInput 
        label="Password" 
        type="password" 
        value={formData.password} 
        onChange={e => setFormData({...formData, password: e.target.value})} 
      />
      
      <FloatingLabelInput 
        label="Confirm Password" 
        type="password" 
        value={formData.confirmPassword} 
        onChange={e => setFormData({...formData, confirmPassword: e.target.value})} 
      />

      <button 
        onClick={handleRegister} 
        className="w-full cursor-pointer bg-primary-dark text-white py-3.5 lg:py-2 rounded-full text-[15px] lg:text-[12px] font-semibold shadow-lg shadow-blue-900/20 mt-4 lg:mt-1 active:scale-[0.98] hover:bg-primary-dark/90 transition-all font-sans"
      >
        Next
      </button>
      
      <p className="text-center text-xs lg:text-[10px] text-gray-500 mt-6 lg:mt-3 font-sans font-medium">
        Already have an account? <span onClick={() => navigate('/login')} className="text-primary-dark font-bold cursor-pointer hover:underline">Login</span>
      </p>
    </div>
  );
};