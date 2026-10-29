import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, AuthCard, AuthHeading, OutlineButton, PrimaryButton, ToastStack } from './ui';
import { useToasts } from './authHelpers';

const VerifyTab = ({ label, isActive, isVerified, onClick }) => (
  <button
    type="button"
    role="tab"
    aria-selected={isActive}
    onClick={onClick}
    className={`flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full font-jakarta text-[14px] font-semibold transition-colors ${
      isActive ? 'bg-walnut text-blush shadow-[0_4px_12px_rgba(107,85,69,0.25)]' : 'text-mid hover:text-ink'
    } lg:h-8 lg:text-[12.5px]`}
  >
    {isVerified ? (
      <span
        className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${isActive ? 'bg-blush text-walnut' : 'bg-green-600 text-white'} lg:h-[15px] lg:w-[15px]`}
        aria-label="verified"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.58l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
      </span>
    ) : null}
    {label}
  </button>
);

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

  // Paste or SMS autofill of the whole code into any box.
  const handlePaste = (e) => {
    const digits = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    onChange(digits);
    inputs.current[Math.min(digits.length, 5)]?.focus();
    if (digits.length === 6) onEnter(digits);
  };

  return (
    <div className="flex w-full justify-between gap-2 sm:gap-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`}
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(e.target.value, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={handlePaste}
          className="h-14 w-full min-w-0 rounded-[14px] border border-pale bg-white text-center font-jakarta text-[22px] font-bold text-ink transition-colors hover:border-soft sm:h-[60px] lg:h-12 lg:rounded-[11px] lg:text-[18px]"
        />
      ))}
    </div>
  );
};

// --- MAIN FORM ---

export const VerificationForm = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  
  const { toasts, addToast, removeToast } = useToasts();

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
          const landing = userType === 'vendor' || userType === 'jeweller' ? '/vendor/kyc' : '/customer';
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
  const bothVerified = phoneVerified && emailVerified;

  return (
    <div>
      <ToastStack toasts={toasts} onClose={removeToast} />

      <AuthHeading
        size="md"
        eyebrow="Last step"
        title="Confirm your account"
        subtitle="Verify your phone number and email address to finish signing up."
      />

      <AuthCard className="mt-7 lg:mt-5">
        <div role="tablist" aria-label="Verify" className="flex rounded-full border border-pale bg-cream p-1">
          <VerifyTab label="Phone" isActive={activeTab === 'phone'} isVerified={phoneVerified} onClick={() => setActiveTab('phone')} />
          <VerifyTab label="Email" isActive={activeTab === 'email'} isVerified={emailVerified} onClick={() => setActiveTab('email')} />
        </div>

        {!isCurrentVerified ? (
          <div className="mt-6 lg:mt-5">
            <p className="font-jakarta text-[14px] leading-[1.6] text-mid lg:text-[12.5px]">
              Enter the 6-digit code sent to{' '}
              <span className="font-semibold text-ink">
                {activeTab === 'phone' ? `${tempUser.countryCode} ${tempUser.phone}` : tempUser.email}
              </span>
            </p>
            <div className="mt-4 lg:mt-3">
              <OtpInputGroup
                value={activeTab === 'phone' ? phoneOtp : emailOtp}
                onChange={activeTab === 'phone' ? setPhoneOtp : setEmailOtp}
                onEnter={handleVerify}
              />
            </div>
            <PrimaryButton onClick={() => handleVerify()} disabled={loading} className="mt-6 w-full lg:mt-5">
              {loading ? 'Verifying…' : 'Verify code'}
            </PrimaryButton>
            <p className="mt-4 text-center font-jakarta text-[14px] text-mid lg:mt-3 lg:text-[12.5px]">
              Didn't get it?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={currentTimer > 0 || loading}
                className="cursor-pointer font-semibold text-ink underline decoration-soft underline-offset-[3px] hover:decoration-ink disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
              >
                {currentTimer > 0 ? `Resend in ${currentTimer}s` : 'Resend code'}
              </button>
            </p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center text-center lg:mt-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-700 lg:h-10" aria-hidden>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <h2 className="mt-3 font-jakarta text-[18px] font-bold tracking-[-0.02em] text-ink lg:mt-2.5 lg:text-[15px]">
              {activeTab === 'phone' ? 'Phone number verified' : 'Email address verified'}
            </h2>
            <p className="mt-1 font-jakarta text-[14px] text-mid lg:text-[12.5px]">
              {bothVerified ? 'You’re all set.' : `Next, verify your ${activeTab === 'phone' ? 'email address' : 'phone number'}.`}
            </p>
            {bothVerified ? (
              <PrimaryButton onClick={handleFinalSubmit} className="mt-6 w-full lg:mt-5">
                Complete registration <ArrowRight />
              </PrimaryButton>
            ) : (
              <OutlineButton onClick={() => setActiveTab(activeTab === 'phone' ? 'email' : 'phone')} className="mt-6 w-full lg:mt-5">
                Verify {activeTab === 'phone' ? 'email' : 'phone'} next <ArrowRight />
              </OutlineButton>
            )}
          </div>
        )}
      </AuthCard>
    </div>
  );
};
