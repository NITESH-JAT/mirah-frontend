import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

// --- TOAST COMPONENT ---
const ToastNotification = ({ id, message, type, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 400); 
  };

  useEffect(() => {
    const timer = setTimeout(() => handleClose(), 10000); 
    return () => clearTimeout(timer);
  }, []);

  const isError = type === 'error';

  return (
    <div className={`
      relative w-[320px] bg-white rounded-[12px] shadow-xl border-l-4 p-4 mb-3 flex gap-3 items-start transition-all
      ${isError ? 'border-red-500' : 'border-green-500'}
      ${isExiting ? 'animate-fade-out' : 'animate-slide-in'}
    `}>
      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${isError ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
        {isError ? (
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" /></svg>
        ) : (
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
        )}
      </div>
      <div className="flex-1 pt-0.5">
        <h4 className={`font-sans text-[15px] font-bold leading-none mb-1 ${isError ? 'text-red-600' : 'text-primary-dark'}`}>
          {isError ? 'Error' : 'Success'}
        </h4>
        <p className="text-gray-500 font-sans text-[13px] leading-snug">{message}</p>
      </div>
      <button onClick={handleClose} className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors cursor-pointer p-1">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};

// --- UI COMPONENTS ---

const VerificationTab = ({ label, isActive, isVerified, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-[12px] border transition-all duration-300 font-sans cursor-pointer
        ${isActive 
          ? 'border-primary-dark bg-white shadow-md shadow-blue-900/5 scale-105' 
          : 'border-gray-100 bg-gray-50 text-gray-400 hover:bg-white hover:border-gray-200'
        }
      `}
    >
       <div className={`

        w-5 h-5 rounded-full flex items-center justify-center border transition-colors

        ${isVerified

          ? 'bg-primary-dark border-primary-dark'

          : 'bg-transparent border-gray-300'

        }

      `}>

        {isVerified && (

          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">

            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />

          </svg>

        )}

      </div>

      <span className={`text-[14px] font-bold ${isActive || isVerified ? 'text-primary-dark' : 'text-gray-400'}`}>

        {label}

      </span>

    </button>

  );

};

const OtpInputGroup = ({ value, onChange, onEnter }) => {
  const inputs = useRef([]);

  const handleChange = (val, i) => {
    if (!/^\d*$/.test(val)) return;
    
    const currentChars = value.split('');
    while (currentChars.length < 6) currentChars.push('');
    
    currentChars[i] = val.slice(-1);
    const newValue = currentChars.join('').slice(0, 6);
    
    onChange(newValue);

    if (val && i < 5) inputs.current[i + 1]?.focus();
    
    if (newValue.length === 6) {
        inputs.current[i]?.blur();
        onEnter(newValue);
    }
  };

  const handleKeyDown = (e, i) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
    if (e.key === 'Enter') {
      onEnter(value); 
    }
  };

  return (
    <div className="flex gap-2 lg:gap-3 justify-center w-full max-w-[360px] mx-auto">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(e.target.value, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className="w-11 h-14 lg:w-10 lg:h-12 border border-gray-200 rounded-[12px] lg:rounded-[8px] text-center text-[22px] font-bold text-gray-700 focus:border-primary-dark focus:ring-1 focus:ring-primary-dark/10 focus:outline-none transition-all bg-white shadow-sm font-sans placeholder:text-gray-200"
        />
      ))}
    </div>
  );
};

// --- MAIN FORM ---

export const VerificationForm = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  
  const [toasts, setToasts] = useState([]);
  const addToast = (message, type = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const [tempUser, setTempUser] = useState(null);
  const [activeTab, setActiveTab] = useState('phone');
  
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  
  const [loading, setLoading] = useState(false);
  
  // Independent Timers
  const [phoneTimer, setPhoneTimer] = useState(0);
  const [emailTimer, setEmailTimer] = useState(0);

  // Load User Data
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mirah_temp_user');
      if (!stored) throw new Error();
      const userData = JSON.parse(stored);
      setTempUser(userData);

      const pVerified = userData.isPhoneVerified === true || userData.phoneVerified === true || userData.phoneVerified === "true";
      const eVerified = userData.isEmailVerified === true || userData.emailVerified === true || userData.emailVerified === "true";

      setPhoneVerified(pVerified);
      setEmailVerified(eVerified);

      if (pVerified && !eVerified) {
         setActiveTab('email');
      }

    } catch {
      navigate('/register');
    }
  }, [navigate]);

  // Handle Timers
  useEffect(() => {
    let interval = setInterval(() => {
        setPhoneTimer(prev => prev > 0 ? prev - 1 : 0);
        setEmailTimer(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handlers
  const handleVerify = async (manualOtp) => {
    const otpFromState = activeTab === 'phone' ? phoneOtp : emailOtp;
    const currentOtp = typeof manualOtp === 'string' ? manualOtp : otpFromState;

    if (!currentOtp || currentOtp.length !== 6) return;

    setLoading(true);
    try {
      let updatedData;
      if (activeTab === 'phone') {
        updatedData = await authService.verifyPhoneOtp(tempUser.phone, currentOtp, tempUser.countryCode);
        setPhoneVerified(true);
        addToast("Phone verified successfully!", "success");
        // After phone OTP success, always move user to the email OTP step.
        // (Email verification status is derived separately via emailVerified.)
        setActiveTab('email');
      } else {
        updatedData = await authService.verifyEmailOtp(tempUser.email, currentOtp);
        setEmailVerified(true);
        addToast("Email verified successfully!", "success");
      }
      

      setTempUser(prev => ({ ...prev, ...updatedData }));
      
    } catch (err) {
      addToast(err.message || "Verification Failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const isPhone = activeTab === 'phone';
    if (isPhone && phoneTimer > 0) return;
    if (!isPhone && emailTimer > 0) return;
    
    setLoading(true);
    try {
      if (isPhone) {
        await authService.resendPhoneOtp(tempUser.phone, tempUser.countryCode);
        addToast("Code resent to your phone!", "success");
        setPhoneTimer(30);
      } else {
        await authService.resendEmailOtp(tempUser.email);
        addToast("Code resent to your email!", "success");
        setEmailTimer(30);
      }
    } catch (err) {
      addToast(err.message || "Failed to resend", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async () => {

      const storedTemp = JSON.parse(localStorage.getItem('mirah_temp_user') || '{}');
      
      const finalUser = { 
          ...storedTemp, 
          isPhoneVerified: true, 
          isEmailVerified: true 
      };

      // CHECK FOR TOKEN
      // If we have a token, we can go to dashboard.
      // If NOT, we must force a login.
      const extractedToken =
        finalUser?.token ||
        finalUser?.accessToken ||
        finalUser?.access_token ||
        finalUser?.jwt ||
        finalUser?.jwtToken ||
        finalUser?.accessJwt ||
        finalUser?.data?.token ||
        finalUser?.data?.accessToken ||
        finalUser?.data?.access_token ||
        finalUser?.data?.jwt ||
        finalUser?.data?.jwtToken ||
        finalUser?.data?.accessJwt ||
        finalUser?.data?.data?.token ||
        finalUser?.data?.data?.accessToken ||
        finalUser?.data?.data?.access_token ||
        finalUser?.data?.data?.jwt ||
        finalUser?.data?.data?.jwtToken ||
        finalUser?.data?.data?.accessJwt ||
        finalUser?.user?.token ||
        finalUser?.user?.accessToken ||
        finalUser?.user?.access_token ||
        finalUser?.user?.jwt ||
        finalUser?.user?.jwtToken ||
        finalUser?.user?.accessJwt ||
        null;

      const normalizedFinalUser = extractedToken ? { ...finalUser, token: extractedToken } : finalUser;

      if (normalizedFinalUser?.token) {
          localStorage.setItem('mirah_session_user', JSON.stringify(normalizedFinalUser));
          localStorage.removeItem('mirah_temp_user');
          // Hydrate via /me so we have kyc + canSell flags before routing
          const hydrated = await authService.me().catch(() => normalizedFinalUser);
          setUser(hydrated);
          addToast("Registration Complete!", "success");
          const userType = String(hydrated?.userType || '').toLowerCase();
          // PRD requirement: after verification, route to KYC (jeweller/vendor) or Shop (customer)
          const landing = userType === 'vendor' || userType === 'jeweller' ? '/vendor/kyc' : '/dashboard/shopping';
          setTimeout(() => navigate(landing), 500);
      } else {
          // Token should be present per PRD. If it's not, redirect to login.
          localStorage.removeItem('mirah_temp_user');
          addToast("Verification complete! Please login.", "success");
          setTimeout(() => navigate('/login'), 1500);
      }
  };

  if (!tempUser) return null;

  const isCurrentVerified = activeTab === 'phone' ? phoneVerified : emailVerified;
  const currentTimer = activeTab === 'phone' ? phoneTimer : emailTimer;

  return (
    <div className="w-full flex flex-col items-center pt-6 px-1 h-[calc(100dvh-140px)] lg:h-[82vh]">

      {/* TOAST CONTAINER */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col items-end pointer-events-none">
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
      
      {/* Header */}
      <div className="shrink-0 text-center mb-8 lg:mb-6 w-full px-4">
        <h1 className="font-serif text-[30px] lg:text-[24px] font-bold text-primary-dark mb-1">Verification</h1>
        <p className="font-sans text-gray-400 text-[14px] lg:text-[11px] tracking-wide">
            Please verify both your phone number and email address.
        </p>
      </div>

      {/* Tabs */}
      <div className="shrink-0 w-full max-w-[340px] flex gap-3 mb-8">
        <VerificationTab 
          label="Phone" 
          isActive={activeTab === 'phone'} 
          isVerified={phoneVerified} 
          onClick={() => setActiveTab('phone')}
        />
        <VerificationTab 
          label="Email" 
          isActive={activeTab === 'email'} 
          isVerified={emailVerified} 
          onClick={() => setActiveTab('email')}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full flex flex-col items-center animate-fade-in">
        
        {!isCurrentVerified ? (
            <>
                <p className="text-gray-500 font-sans text-[14px] mb-8 text-center max-w-[280px] leading-relaxed">
                    Enter the 6-digit code sent to <br/>
                    <span className="font-bold text-primary-dark text-[15px]">
                        {activeTab === 'phone' ? `${tempUser.countryCode} ${tempUser.phone}` : tempUser.email}
                    </span>
                </p>

                <OtpInputGroup 
                    value={activeTab === 'phone' ? phoneOtp : emailOtp}
                    onChange={activeTab === 'phone' ? setPhoneOtp : setEmailOtp}
                    onEnter={handleVerify} 
                />

                <div className="mt-8 text-center font-sans">
                    <button 
                        onClick={handleResend} 
                        disabled={currentTimer > 0 || loading}
                        className={`text-[13px] font-semibold transition-colors
                            ${currentTimer > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-primary-dark cursor-pointer'}
                        `}
                    >
                        {currentTimer > 0 ? `Resend Code in ${currentTimer}s` : 'Resend Code'}
                    </button>
                </div>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center p-8 w-full max-w-[340px] bg-white rounded-[20px] border border-gray-100 shadow-xl shadow-blue-900/5">
                <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-4 border border-green-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-primary-dark font-bold text-lg font-serif mb-1">Verified Successfully</h3>
                <p className="text-gray-400 text-[13px] font-sans text-center mb-6">
                    {activeTab === 'phone' ? 'Your phone number has been secured.' : 'Your email address has been confirmed.'}
                </p>
                
                {(!phoneVerified || !emailVerified) && (
                      <button 
                        onClick={() => setActiveTab(activeTab === 'phone' ? 'email' : 'phone')}
                        className="w-full py-3 rounded-[12px] bg-gray-50 text-gray-600 text-[13px] font-bold hover:bg-gray-100 transition-colors cursor-pointer border border-gray-100 font-sans"
                      >
                        Verify {activeTab === 'phone' ? 'Email' : 'Phone'} Next →
                      </button>
                )}
            </div>
        )}

      </div>

      {/* Bottom Button */}
      <div className="shrink-0 w-full max-w-[360px] pb-6 px-4">
        {!isCurrentVerified ? (
            <button 
                onClick={() => handleVerify()} 
                disabled={loading}
                className="w-full bg-primary-dark text-white py-4 lg:py-3 rounded-full lg:rounded-[20px] text-[16px] lg:text-[13px] font-bold shadow-lg shadow-blue-900/20 active:scale-[0.98] hover:bg-primary-dark/90 transition-all font-sans disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
                {loading ? 'Verifying...' : 'Verify Code'}
            </button>
        ) : (
            <button 
                onClick={handleFinalSubmit} 
                disabled={!phoneVerified || !emailVerified}
                className="w-full bg-primary-dark text-white py-4 lg:py-3 rounded-full lg:rounded-[20px] text-[16px] lg:text-[13px] font-bold shadow-lg shadow-blue-900/20 active:scale-[0.98] hover:bg-primary-dark/90 transition-all font-sans disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
            >
                {(!phoneVerified || !emailVerified) ? 'Verify Both to Continue' : 'Complete Registration'}
            </button>
        )}
      </div>

    </div>
  );
};