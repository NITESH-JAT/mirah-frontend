import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  ArrowRight,
  AuthCard,
  AuthHeading,
  Field,
  OrDivider,
  OutlineButton,
  PasswordInput,
  PhoneInput,
  PrimaryButton,
  SegmentedTabs,
  TextInput,
  TextLink,
  ToastStack,
} from './ui';
import { toDialCodeOptions, useToasts } from './authHelpers';

const CONTACT_TABS = [
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
];

export const LoginForm = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { toasts, addToast, removeToast } = useToasts();

  /** 'login' | 'forgot-request' | 'forgot-reset' */
  const [view, setView] = useState('login');
  const [loginType, setLoginType] = useState('phone');
  const [loading, setLoading] = useState(false);
  const [countryRows, setCountryRows] = useState([]);

  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    countryCode: '',
    password: '',
    otp: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  const codeOptions = useMemo(() => toDialCodeOptions(countryRows), [countryRows]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await authService.getCountryCodes();
        const data = Array.isArray(response) ? response : response.data || [];
        setCountryRows(data);

        try {
          const geoRes = await fetch('https://ipapi.co/json/');
          const geoInfo = await geoRes.json();
          const matched = geoInfo && data.find((c) => c.countryCode === geoInfo.country_code);
          if (!matched) throw new Error('Geo match failed');
          setFormData((prev) => (prev.countryCode ? prev : { ...prev, countryCode: matched.phoneCode }));
        } catch {
          const fallback = data.find((c) => c.countryName === 'India' || c.countryCode === 'IN' || c.phoneCode === '+91') || data[0];
          if (fallback) setFormData((prev) => (prev.countryCode ? prev : { ...prev, countryCode: fallback.phoneCode }));
        }
      } catch (e) {
        console.error(e);
        addToast('Failed to load country codes.', 'error');
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const contactPayload = () => ({
    type: loginType,
    email: loginType === 'email' ? formData.email : null,
    phone: loginType === 'phone' ? formData.phone : null,
    countryCode: loginType === 'phone' ? formData.countryCode : null,
  });

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const userData = await authService.login({ ...contactPayload(), password: formData.password });

      const isVerified = userData?.isVerified === true || (userData?.phoneVerified && userData?.emailVerified);

      if (isVerified) {
        // authService.login already persisted session; hydrate via /me for accurate kyc/canSell flags
        const hydrated = await authService.me().catch(() => userData);
        setUser(hydrated);
        const isVendor = hydrated?.userType === 'vendor' || hydrated?.userType === 'jeweller';
        const kycStatus = String(hydrated?.kyc?.status || '').toLowerCase();
        // If vendor and KYC verified, land on Explore page; otherwise use KYC flow
        const vendorLanding = kycStatus === 'accepted' ? '/vendor/explore' : '/vendor/kyc';
        navigate(isVendor ? vendorLanding : '/customer');
        addToast('Welcome back!', 'success');
      } else {
        localStorage.setItem('mirah_temp_user', JSON.stringify(userData));
        navigate('/verification');
        addToast('Please verify your account.', 'error');
      }
    } catch (err) {
      const errorMsg = (err.message || '').toLowerCase();

      if (errorMsg.includes('verify') || errorMsg.includes('otp') || errorMsg.includes('not verified')) {
        const backendData = err.data || err.response?.data?.data;
        if (backendData) {
          const tempUser = {
            ...backendData,
            email: backendData.email || (loginType === 'email' ? formData.email : undefined),
            phone: backendData.phone || (loginType === 'phone' ? formData.phone : undefined),
            countryCode: backendData.countryCode || (loginType === 'phone' ? formData.countryCode : undefined),
          };
          localStorage.setItem('mirah_temp_user', JSON.stringify(tempUser));
          setTimeout(() => navigate('/verification'), 1500);
          addToast('Please verify your account.', 'error');
        } else {
          addToast(err.message, 'error');
        }
      } else {
        addToast(err.message || 'Login failed', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequest = async (e) => {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await authService.forgotPassword(contactPayload());
      setView('forgot-reset');
      addToast('We sent you a 6-digit code.', 'success');
    } catch (err) {
      addToast(err.message || String(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e?.preventDefault();
    if (loading) return;
    if (formData.newPassword.length < 8) {
      addToast('Password must be at least 8 characters.', 'error');
      return;
    }
    if (formData.newPassword !== formData.confirmNewPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword({ ...contactPayload(), otp: formData.otp, newPassword: formData.newPassword });
      addToast('Password reset. Please sign in with your new password.', 'success');
      setView('login');
      setFormData((prev) => ({ ...prev, password: '', otp: '', newPassword: '', confirmNewPassword: '' }));
    } catch (err) {
      addToast(err.message || String(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const contactInput =
    loginType === 'phone' ? (
      <PhoneInput
        codeOptions={codeOptions}
        countryCode={formData.countryCode}
        onCountryCodeChange={(countryCode) => setFormData((prev) => ({ ...prev, countryCode }))}
        name="phone"
        autoComplete="tel-national"
        aria-label="Phone number"
        placeholder="Phone number"
        value={formData.phone}
        onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
      />
    ) : (
      <TextInput
        type="email"
        name="email"
        inputMode="email"
        autoComplete="email"
        aria-label="Email address"
        placeholder="you@example.com"
        value={formData.email}
        onChange={handleChange}
      />
    );

  const destination = loginType === 'phone' ? `${formData.countryCode} ${formData.phone}`.trim() : formData.email;

  return (
    <>
      <ToastStack toasts={toasts} onClose={removeToast} />

      {view === 'login' && (
        <div>
          <AuthHeading
            eyebrow="New to Arviah?"
            title="Find your next manufacturing partner."
            subtitle="Create an account to start your jewellery requirement."
          />
          <PrimaryButton className="mt-7 w-full lg:mt-5" onClick={() => navigate('/register')}>
            Create a free account <ArrowRight />
          </PrimaryButton>

          <OrDivider />

          <AuthCard>
            <p className="font-jakarta text-[13px] font-medium text-mid lg:text-[12px]">Already have an account?</p>
            <h2 className="mt-1 font-jakarta text-[22px] font-bold tracking-[-0.03em] text-ink lg:text-[18px]">Sign in</h2>

            <form className="mt-5 lg:mt-4" onSubmit={handleLogin} noValidate>
              <SegmentedTabs label="Sign in with" options={CONTACT_TABS} value={loginType} onChange={setLoginType} />
              <div className="mt-4 space-y-3 lg:mt-3 lg:space-y-2.5">
                {contactInput}
                <PasswordInput
                  name="password"
                  aria-label="Password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
              <div className="mt-5 flex flex-col-reverse items-center gap-4 sm:flex-row sm:justify-between lg:mt-4">
                <TextLink className="text-[14px] lg:text-[12.5px]" onClick={() => setView('forgot-request')}>
                  Forgot password?
                </TextLink>
                <OutlineButton type="submit" disabled={loading} className="w-full sm:w-auto sm:min-w-[150px]">
                  {loading ? 'Signing in…' : 'Sign in'}
                </OutlineButton>
              </div>
            </form>
          </AuthCard>
        </div>
      )}

      {view === 'forgot-request' && (
        <div>
          <BackLink onClick={() => setView('login')}>Back to sign in</BackLink>
          <AuthHeading
            size="md"
            title="Reset your password"
            subtitle="Enter the phone number or email on your account and we'll send you a 6-digit code."
          />
          <AuthCard className="mt-7 lg:mt-5">
            <form onSubmit={handleForgotRequest} noValidate>
              <SegmentedTabs label="Reset with" options={CONTACT_TABS} value={loginType} onChange={setLoginType} />
              <div className="mt-4 lg:mt-3">{contactInput}</div>
              <PrimaryButton type="submit" disabled={loading} className="mt-5 w-full lg:mt-4">
                {loading ? 'Sending code…' : 'Send code'} {!loading && <ArrowRight />}
              </PrimaryButton>
            </form>
          </AuthCard>
        </div>
      )}

      {view === 'forgot-reset' && (
        <div>
          <BackLink onClick={() => setView('forgot-request')}>Change {loginType === 'phone' ? 'phone number' : 'email'}</BackLink>
          <AuthHeading
            size="md"
            title="Choose a new password"
            subtitle={
              <>
                Enter the code we sent to <span className="font-semibold text-ink">{destination}</span>.
              </>
            }
          />
          <AuthCard className="mt-7 lg:mt-5">
            <form onSubmit={handleResetPassword} noValidate className="space-y-4 lg:space-y-3">
              <Field label="6-digit code" htmlFor="reset-otp">
                <TextInput
                  id="reset-otp"
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  value={formData.otp}
                  onChange={(e) => setFormData((prev) => ({ ...prev, otp: e.target.value.replace(/\D/g, '') }))}
                  className="tracking-[0.4em]"
                />
              </Field>
              <Field label="New password" htmlFor="reset-new">
                <PasswordInput
                  id="reset-new"
                  name="newPassword"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={formData.newPassword}
                  onChange={handleChange}
                />
              </Field>
              <Field label="Confirm new password" htmlFor="reset-confirm">
                <PasswordInput
                  id="reset-confirm"
                  name="confirmNewPassword"
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  value={formData.confirmNewPassword}
                  onChange={handleChange}
                />
              </Field>
              <PrimaryButton type="submit" disabled={loading} className="!mt-6 w-full">
                {loading ? 'Resetting…' : 'Reset password'}
              </PrimaryButton>
            </form>
            <p className="mt-5 text-center font-jakarta text-[14px] text-mid lg:mt-4 lg:text-[12.5px]">
              Didn't get a code?{' '}
              <TextLink onClick={handleForgotRequest} disabled={loading}>
                Send again
              </TextLink>
            </p>
          </AuthCard>
        </div>
      )}
    </>
  );
};

function BackLink({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-6 inline-flex cursor-pointer items-center gap-1.5 font-jakarta text-[14px] font-semibold text-mid transition-colors hover:text-ink lg:mb-5 lg:text-[12.5px]"
    >
      <ArrowLeft /> {children}
    </button>
  );
}
