import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';

const VerificationTab = ({ type, label, isActive, isVerified, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full border transition-all duration-300
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
          className="w-10 h-12 lg:w-9 lg:h-10 border border-gray-200 rounded-[7px] text-center text-[20px] font-bold text-primary-dark focus:border-primary-dark focus:ring-1 focus:ring-primary-dark/20 focus:outline-none transition-all bg-gray-50 focus:bg-white shadow-sm"
        />
      ))}
    </div>
  );
};

export const VerificationForm = () => {
  const navigate = useNavigate();
  
  const [tempUser, setTempUser] = useState(null);
  
  const [activeTab, setActiveTab] = useState('phone');
  
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

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

    } catch (e) {
      navigate('/register');
    }
  }, [navigate]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handlers
  const handleVerify = async (manualOtp) => {

    const otpFromState = activeTab === 'phone' ? phoneOtp : emailOtp;
    const currentOtp = typeof manualOtp === 'string' ? manualOtp : otpFromState;

    if (!currentOtp || currentOtp.length !== 6) return;

    setLoading(true);
    try {
      if (activeTab === 'phone') {
        await authService.verifyPhoneOtp(tempUser.phone, currentOtp, tempUser.countryCode);
        setPhoneVerified(true);
        if (!emailVerified) {
             setActiveTab('email');
        }
      } else {
        await authService.verifyEmailOtp(tempUser.email, currentOtp);
        setEmailVerified(true);
      }
    } catch (err) {
      alert(err.message || err || "Verification Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    try {
      if (activeTab === 'phone') {
        await authService.resendPhoneOtp(tempUser.phone, tempUser.countryCode);
        alert("Code resent to your phone!");
      } else {
        await authService.resendEmailOtp(tempUser.email);
        alert("Code resent to your email!");
      }
      setResendCooldown(30);
    } catch (err) {
      alert(err.message || err || "Failed to resend");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = () => {
      const finalUser = { ...tempUser, isPhoneVerified: true, isEmailVerified: true };
      localStorage.setItem('mirah_session_user', JSON.stringify(finalUser));
      localStorage.removeItem('mirah_temp_user');
      navigate('/dashboard/profile');
  };

  if (!tempUser) return null;

  const isCurrentVerified = activeTab === 'phone' ? phoneVerified : emailVerified;

  return (
    <div className="w-full h-[85vh] flex flex-col items-center pt-2">
      
      {/* 1. Header */}
      <div className="shrink-0 text-center mb-8 lg:mb-10 w-full px-4">
        <h1 className="font-serif text-[26px] font-bold text-primary-dark mb-2">Verification</h1>
        <p className="font-sans text-gray-400 text-[14px]">
            Please verify both your phone number and email address.
        </p>
      </div>

      {/* 2. Tabs */}
      <div className="shrink-0 w-full max-w-[340px] flex gap-4 mb-10 px-2">
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

      <div className="flex-1 w-full flex flex-col items-center animate-fade-in px-4">
        
        {!isCurrentVerified ? (
            <>
                <p className="text-gray-400 text-[14px] mb-8 text-center max-w-[280px]">
                    Enter the 6-digit code sent to <br/>
                    <span className="font-bold text-gray-600">
                        {activeTab === 'phone' ? `${tempUser.countryCode} ${tempUser.phone}` : tempUser.email}
                    </span>
                </p>

                <OtpInputGroup 
                    value={activeTab === 'phone' ? phoneOtp : emailOtp}
                    onChange={activeTab === 'phone' ? setPhoneOtp : setEmailOtp}
                    onEnter={handleVerify} 
                />

                <div className="mt-8 text-center">
                    <button 
                        onClick={handleResend} 
                        disabled={resendCooldown > 0 || loading}
                        className={`text-[13px] font-semibold decoration-gray-300 hover:decoration-primary-dark transition-all
                            ${resendCooldown > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-primary-dark cursor-pointer'}
                        `}
                    >
                        {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Code'}
                    </button>
                </div>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center h-[200px] w-full bg-green-50/50 rounded-3xl border border-green-100 max-w-[360px]">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-green-800 font-bold text-lg font-serif">Verified Successfully!</h3>
                <p className="text-green-600 text-xs mt-1">
                    {activeTab === 'phone' ? 'Your phone number is secured.' : 'Your email is confirmed.'}
                </p>
                {(!phoneVerified || !emailVerified) && (
                     <button 
                        onClick={() => setActiveTab(activeTab === 'phone' ? 'email' : 'phone')}
                        className="mt-6 bg-white text-green-700 px-6 py-2 rounded-full text-xs font-bold shadow-sm border border-green-200 hover:bg-green-50 cursor-pointer"
                     >
                        Verify {activeTab === 'phone' ? 'Email' : 'Phone'} Now →
                     </button>
                )}
            </div>
        )}

      </div>

      <div className="shrink-0 w-full max-w-[360px] pb-6 px-4">
        {!isCurrentVerified ? (
            <button 
                onClick={() => handleVerify()} 
                disabled={loading}
                className="w-full bg-primary-dark text-white py-4 rounded-full text-[15px] font-bold shadow-lg shadow-blue-900/20 active:scale-[0.98] hover:bg-primary-dark/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
                {loading ? 'Verifying...' : 'Verify Code'}
            </button>
        ) : (
             <button 
                onClick={handleFinalSubmit} 
                disabled={!phoneVerified || !emailVerified}
                className="w-full bg-primary-dark text-white py-4 rounded-full text-[15px] font-bold shadow-lg shadow-blue-900/20 active:scale-[0.98] hover:bg-primary-dark/90 transition-all disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none cursor-pointer"
            >
                {(!phoneVerified || !emailVerified) ? 'Verify Both to Continue' : 'Complete Registration'}
            </button>
        )}
      </div>

    </div>
  );
};