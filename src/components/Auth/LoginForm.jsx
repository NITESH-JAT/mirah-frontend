import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';

// SHARED COMPONENTS

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

const MainLayout = ({ children }) => (
    <div className="w-full flex flex-col relative">
        {children}
    </div>
);

const InputField = ({ label, className, type="text", readOnly, required, error, ...props }) => (
  <div className={`w-full ${className}`}>
    {label && (
      <label className="block text-gray-700 text-sm font-medium mb-1">
        {label} {required && <span className="text-red-500 text-sm ml-1">*</span>}
      </label>
    )}
    <input
      type={type}
      readOnly={readOnly}
      {...props}
      className={`w-full px-5 py-4 lg:px-4 lg:py-3 rounded-[12px] border text-gray-700 text-[15px] lg:text-[14px] font-medium placeholder:text-gray-400 focus:outline-none focus:ring-1 transition-all font-sans 
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

const PasswordInput = ({ placeholder, value, onChange, name, required, error }) => {
  const [show, setShow] = useState(false);
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
          className={`w-full px-5 py-4 lg:px-4 lg:py-3 rounded-[12px] border text-gray-700 text-[15px] lg:text-[14px] font-medium placeholder:text-gray-400 focus:outline-none focus:ring-1 transition-all font-sans pr-10
            ${error 
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' 
              : 'border-gray-200 focus:border-primary-dark focus:ring-primary-dark/10'
            }
          `}
        />
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

const CustomSelect = ({ options, placeholder, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);

  useClickOutside(wrapperRef, () => {
      setIsOpen(false);
      setSearchTerm("");
  });

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
        searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = options.filter(opt => 
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
      String(opt.value).includes(searchTerm)
  );

  const selectedLabel = options.find(o => (o.value || o) === value)?.label || value || placeholder;

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-4 lg:px-3 lg:py-3 pr-8 rounded-[12px] border border-gray-200 text-[15px] lg:text-[14px] font-medium bg-white cursor-pointer flex items-center hover:border-gray-300 transition-colors"
      >
        <span className="truncate">{selectedLabel}</span>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
           <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-[12px] shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-50 bg-gray-50/50">
             <input 
               ref={searchInputRef}
               type="text" 
               placeholder="Search country..." 
               className="w-full px-2 py-2 text-[13px] border border-gray-200 rounded-md focus:outline-none focus:border-primary-dark"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               onClick={(e) => e.stopPropagation()}
             />
          </div>
          <ul className="max-h-[180px] overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => (
                    <li 
                        key={idx} 
                        onClick={() => { onChange({ target: { value: opt.value } }); setIsOpen(false); setSearchTerm(""); }} 
                        className="px-3 py-3 text-[13px] text-gray-700 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                    >
                    {opt.label}
                    </li>
                ))
            ) : (
                <li className="px-3 py-3 text-[12px] text-gray-400 text-center italic">No results found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

const VerificationTab = ({ label, isActive, onClick }) => (
  <button onClick={onClick} className={`flex-1 flex items-center justify-center py-3.5 px-6 lg:py-2.5 rounded-full border transition-all duration-300 cursor-pointer ${isActive ? 'border-primary-dark bg-white shadow-md shadow-blue-900/5 text-primary-dark font-bold' : 'border-gray-100 bg-gray-50 text-gray-400 hover:bg-white hover:border-gray-200'}`}>
    <span className="text-[14px]">{label}</span>
  </button>
);


// LOGIN FORM COMPONENT

export const LoginForm = () => {
  const navigate = useNavigate();
   
  const [view, setView] = useState('login'); 
  const [loginType, setLoginType] = useState('phone'); 
   
  const [loading, setLoading] = useState(false);
  const [countryCodes, setCountryCodes] = useState([]);
   
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    countryCode: '',
    password: '',
    otp: '',
    newPassword: ''
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await authService.getCountryCodes();
        const data = Array.isArray(response) ? response : (response.data || []);
        const validCodes = data.map(c => ({
          value: c.phoneCode,
          label: `${c.countryCode} ${c.phoneCode}`
        }));
        setCountryCodes(validCodes);
        if(validCodes.length > 0 && !formData.countryCode) {
           setFormData(prev => ({ ...prev, countryCode: validCodes[0].value }));
        }
      } catch (e) { console.error(e); }
    };
    loadData();
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // HANDLE LOGIN
  const handleLogin = async () => {
    setLoading(true);
    try {
      const payload = {
        type: loginType,
        email: loginType === 'email' ? formData.email : null,
        phone: loginType === 'phone' ? formData.phone : null,
        countryCode: loginType === 'phone' ? formData.countryCode : null,
        password: formData.password
      };

      const response = await authService.login(payload);
      
      let userData = null;
      if (response.data && response.data.user) {
         userData = response.data.user;
      } else if (response.user) {
         userData = response.user;
      } else {
         userData = response;
      }
      
      const isVerified = userData.isVerified === true || (userData.phoneVerified && userData.emailVerified);

      if (isVerified) {
        localStorage.setItem('mirah_session_user', JSON.stringify(userData));
        navigate('/dashboard/store');
      } else {
        localStorage.setItem('mirah_temp_user', JSON.stringify(userData));
        navigate('/verification');
      }

    } catch (err) {
      const errorMsg = (err.message || "").toLowerCase();
      
      if (errorMsg.includes('verify') || errorMsg.includes('otp') || errorMsg.includes('not verified')) {
         

         const backendData = err.data || (err.response && err.response.data && err.response.data.data);


         const tempUser = {
            ...backendData,
            email: backendData?.email || (loginType === 'email' ? formData.email : undefined),
            phone: backendData?.phone || (loginType === 'phone' ? formData.phone : undefined),
            countryCode: backendData?.countryCode || (loginType === 'phone' ? formData.countryCode : undefined),
            isPhoneVerified: backendData?.isPhoneVerified,
            isEmailVerified: backendData?.isEmailVerified
         };

         localStorage.setItem('mirah_temp_user', JSON.stringify(tempUser));
         
         alert(err.message || "Please verify your account to continue.");
         navigate('/verification');
      } else {
         alert("Login Failed: " + (err.message || "Unknown error"));
      }
    } finally {
      setLoading(false);
    }
  };

  // HANDLE FORGOT PASSWORD (SEND OTP)
  const handleForgotRequest = async () => {
    setLoading(true);
    try {
      const payload = {
        type: loginType,
        email: loginType === 'email' ? formData.email : null,
        phone: loginType === 'phone' ? formData.phone : null,
        countryCode: loginType === 'phone' ? formData.countryCode : null
      };

      await authService.forgotPassword(payload);
      setView('forgot-reset');
    } catch (err) {
      alert("Error: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // HANDLE RESET PASSWORD
  const handleResetPassword = async () => {
    if (formData.newPassword.length < 8) return alert("Password must be at least 8 chars");
    setLoading(true);
    try {
      const payload = {
        type: loginType,
        email: loginType === 'email' ? formData.email : null,
        phone: loginType === 'phone' ? formData.phone : null,
        countryCode: loginType === 'phone' ? formData.countryCode : null,
        otp: formData.otp,
        newPassword: formData.newPassword
      };

      await authService.resetPassword(payload);
      alert("Password Reset Successfully! Please login.");
      setView('login');
      setFormData(prev => ({ ...prev, password: '', otp: '', newPassword: '' }));
    } catch (err) {
      alert("Reset Failed: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERS ---
  const renderHeader = (title, sub) => (
    <div className="shrink-0 text-center px-4 mb-6 lg:mb-8">
      <h1 className="font-serif text-[30px] lg:text-[36px] font-bold text-primary-dark mb-2">{title}</h1>
      <p className="font-sans text-gray-400 text-[14px] leading-relaxed">{sub}</p>
    </div>
  );

  const renderTabs = () => (
    <div className="shrink-0 w-full max-w-[360px] flex gap-5 mx-auto mb-6 lg:mb-8">
      <VerificationTab label="Phone" isActive={loginType === 'phone'} onClick={() => setLoginType('phone')} />
      <VerificationTab label="Email" isActive={loginType === 'email'} onClick={() => setLoginType('email')} />
    </div>
  );

  const renderContactInputs = () => (
    <div className="w-full mb-5">
      {loginType === 'phone' ? (
        <div className="flex gap-4">
          <div className="w-[110px] shrink-0">
             <CustomSelect 
               placeholder="Code" 
               value={formData.countryCode} 
               onChange={(e) => setFormData({...formData, countryCode: e.target.value})} 
               options={countryCodes} 
             />
          </div>
          <InputField 
            placeholder="Phone Number" 
            name="phone"
            value={formData.phone} 
            onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})} 
          />
        </div>
      ) : (
        <div>
          <InputField 
            placeholder="Email Address" 
            name="email"
            value={formData.email} 
            onChange={handleChange} 
          />
        </div>
      )}
    </div>
  );

  if (view === 'login') {
    return (
      <MainLayout>
        {renderHeader("Welcome Back", "Login to access your store dashboard.")}
        <div className="w-full max-w-[420px] mx-auto pb-4">
            {renderTabs()}
            <div className="w-full space-y-5">
                {renderContactInputs()}
                <div>
                    <PasswordInput 
                    placeholder="Password" 
                    name="password"
                    value={formData.password} 
                    onChange={handleChange} 
                    />
                </div>
                <div className="flex justify-end pt-1">
                    <button onClick={() => setView('forgot-request')} className="text-[13px] text-gray-500 font-medium hover:text-primary-dark transition-colors px-2 py-1 cursor-pointer">
                    Forgot Password?
                    </button>
                </div>
            </div>
        </div>
        <div className="w-full max-w-[420px] mx-auto mt-8 lg:mt-6">
          <button onClick={handleLogin} disabled={loading} className="w-full bg-primary-dark text-white py-4 lg:py-3.5 rounded-full text-[16px] font-bold shadow-lg shadow-blue-900/20 active:scale-[0.98] hover:bg-primary-dark/90 transition-all disabled:opacity-70 cursor-pointer">
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <p className="text-center text-[14px] text-gray-500 mt-6 font-sans font-medium">
            Don't have an account? <span onClick={() => navigate('/register')} className="text-primary-dark font-bold cursor-pointer hover:underline">Sign Up</span>
          </p>
        </div>
      </MainLayout>
    );
  }

  if (view === 'forgot-request') {
    return (
      <MainLayout>
        {renderHeader("Forgot Password", "Enter your details to receive a reset code.")}
        <div className="w-full max-w-[420px] mx-auto pb-4">
           {renderTabs()}
           {renderContactInputs()}
        </div>
        <div className="w-full max-w-[420px] mx-auto mt-8 lg:mt-6">
          <button onClick={handleForgotRequest} disabled={loading} className="w-full bg-primary-dark text-white py-4 lg:py-3.5 rounded-full text-[16px] font-bold shadow-lg shadow-blue-900/20 active:scale-[0.98] hover:bg-primary-dark/90 transition-all disabled:opacity-70 cursor-pointer">
            {loading ? 'Sending Code...' : 'Send OTP'}
          </button>
          <button onClick={() => setView('login')} className="w-full mt-4 text-gray-500 text-[14px] hover:text-gray-700 py-2 font-medium cursor-pointer">Cancel</button>
        </div>
      </MainLayout>
    );
  }

  if (view === 'forgot-reset') {
    return (
      <MainLayout>
        {renderHeader("Reset Password", `Enter the code sent to your ${loginType}.`)}
        <div className="w-full max-w-[420px] mx-auto pb-4 space-y-6">
          <div>
            <InputField placeholder="Enter 6-digit OTP" name="otp" value={formData.otp} onChange={handleChange} className="text-center text-lg tracking-widest"/>
          </div>
          <div>
             <PasswordInput placeholder="New Password (Min 8 chars)" name="newPassword" value={formData.newPassword} onChange={handleChange} />
          </div>
        </div>
        <div className="w-full max-w-[420px] mx-auto mt-8 lg:mt-6">
          <button onClick={handleResetPassword} disabled={loading} className="w-full bg-primary-dark text-white py-4 lg:py-3.5 rounded-full text-[16px] font-bold shadow-lg shadow-blue-900/20 active:scale-[0.98] hover:bg-primary-dark/90 transition-all disabled:opacity-70 cursor-pointer">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
           <button onClick={() => setView('login')} className="w-full mt-4 text-gray-500 text-[14px] hover:text-gray-700 py-2 font-medium cursor-pointer">Back to Login</button>
        </div>
      </MainLayout>
    );
  }
  return null;
};